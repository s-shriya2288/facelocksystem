const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const btnScan = document.getElementById('btnScan');
const btnLock = document.getElementById('btnLock');
const scanOverlay = document.getElementById('scanOverlay');
const lockStatus = document.getElementById('lockStatus');
const logList = document.getElementById('logList');
const systemMessage = document.getElementById('systemMessage');

let isScanning = false;

// Initialize Webcam
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        showMessage("Camera Access Denied or Unavailable", true);
    }
}

// Fetch and update system status
async function updateStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        if (data.is_locked) {
            lockStatus.className = 'status-indicator status-locked';
            lockStatus.querySelector('.status-text').innerText = 'SYSTEM LOCKED';
        } else {
            lockStatus.className = 'status-indicator status-unlocked';
            lockStatus.querySelector('.status-text').innerText = 'SYSTEM UNLOCKED';
        }
    } catch (e) {
        console.error("Failed to update status", e);
    }
}

// Fetch and update logs
async function updateLogs() {
    try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        
        logList.innerHTML = '';
        data.logs.forEach(log => {
            const div = document.createElement('div');
            let logClass = 'locked';
            if (log.status === 'GRANTED') logClass = 'granted';
            if (log.status === 'DENIED') logClass = 'denied';
            
            div.className = `log-item ${logClass}`;
            
            // Format UTC timestamp locally
            let dateStr = log.timestamp;
            if (!dateStr.endsWith('Z')) dateStr += 'Z';
            const date = new Date(dateStr).toLocaleString();
            
            div.innerHTML = `
                <div class="log-time">${date}</div>
                <div class="log-details">
                    <span class="log-user">${log.user}</span>
                    <span class="log-status">${log.status}</span>
                </div>
            `;
            logList.appendChild(div);
        });
    } catch (e) {
        console.error("Failed to update logs", e);
    }
}

function showMessage(msg, isError = false) {
    systemMessage.innerText = msg;
    systemMessage.style.color = isError ? 'var(--error-red)' : 'var(--primary-cyan)';
    systemMessage.style.borderColor = isError ? 'var(--error-red)' : 'var(--primary-cyan)';
    systemMessage.classList.add('show');
    
    // Voice feedback if supported
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
    }
    
    setTimeout(() => {
        systemMessage.classList.remove('show');
    }, 4000);
}

// Perform scan action
async function performScan() {
    if (isScanning) return;
    
    isScanning = true;
    scanOverlay.classList.add('scanning');
    btnScan.innerText = 'Scanning...';
    btnScan.disabled = true;
    
    // Wait for animation to cycle a bit
    setTimeout(async () => {
        // Capture frame
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            const result = await res.json();
            
            if (result.success) {
                showMessage(result.message);
            } else {
                showMessage(result.message, true);
            }
        } catch (err) {
            showMessage("System Error. Authentication failed.", true);
            console.error(err);
        } finally {
            isScanning = false;
            scanOverlay.classList.remove('scanning');
            btnScan.innerText = 'Initiate Scan';
            btnScan.disabled = false;
            
            // Refresh dashboard
            updateStatus();
            updateLogs();
        }
    }, 2000); // 2 second scan delay for visual effect
}

async function lockSystem() {
    try {
        await fetch('/api/lock', { method: 'POST' });
        showMessage("System secured.", false);
        updateStatus();
        updateLogs();
    } catch (e) {
        console.error(e);
    }
}

// Event Listeners
btnScan.addEventListener('click', performScan);
btnLock.addEventListener('click', lockSystem);

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    setupWebcam();
    updateStatus();
    updateLogs(); 
    setInterval(updateLogs, 10000); // Poll logs periodically
});
