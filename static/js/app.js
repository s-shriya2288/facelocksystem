const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const btnRegister = document.getElementById('btnRegister');
const btnScan = document.getElementById('btnScan');
const btnLock = document.getElementById('btnLock');
const scanOverlay = document.getElementById('scanOverlay');
const lockStatus = document.getElementById('lockStatus');
const logList = document.getElementById('logList');
const systemMessage = document.getElementById('systemMessage');
const hasIdentity = document.getElementById('hasIdentity');

let isScanning = false;

// Initialize Webcam
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        video.srcObject = stream;
    } catch (err) {
        showMessage("CRITICAL: VISUAL SENSOR DISCONNECTED", true);
    }
}

async function updateStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        if (data.is_locked) {
            lockStatus.className = 'status-indicator status-locked';
            lockStatus.querySelector('.status-text').innerText = 'VAULT SECURED';
        } else {
            lockStatus.className = 'status-indicator status-unlocked';
            lockStatus.querySelector('.status-text').innerText = 'VAULT OPENED';
        }

        if (data.has_registered_identity) {
            hasIdentity.className = 'badge active';
            hasIdentity.innerText = "MASTER BIOMETRIC LOADED";
        } else {
            hasIdentity.className = 'badge';
            hasIdentity.innerText = "NO MASTER BIOMETRIC SET";
        }
    } catch (e) { console.error(e); }
}

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
            
            let dateStr = log.timestamp;
            if (!dateStr.endsWith('Z')) dateStr += 'Z';
            const date = new Date(dateStr).toLocaleTimeString();
            
            div.innerHTML = `
                <div class="log-time">[${date}] SYSTEM LOG</div>
                <div>>> ${log.action}</div>
                <div>>> ENTITY: ${log.user}</div>
                <div>>> STATUS: ${log.status}</div>
            `;
            logList.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

function showMessage(msg, isSuccess = false) {
    systemMessage.innerText = msg;
    if(isSuccess) {
        systemMessage.style.color = 'var(--success-green)';
        systemMessage.style.borderColor = 'var(--success-green)';
        systemMessage.style.boxShadow = '0 0 30px rgba(0,255,68,0.5)';
    } else {
        systemMessage.style.color = 'var(--primary-red)';
        systemMessage.style.borderColor = 'var(--primary-red)';
        systemMessage.style.boxShadow = '0 0 30px rgba(255,0,0,0.5)';
    }
    
    systemMessage.classList.add('show');
    
    if ('speechSynthesis' in window) {
        // Computer voice parameters
        let msgToSpeek = msg.replace(/[^a-zA-Z ]/g, "");
        const utterance = new SpeechSynthesisUtterance(msgToSpeek);
        utterance.rate = 1.1;
        utterance.pitch = 0.5;
        speechSynthesis.speak(utterance);
    }
    
    setTimeout(() => {
        systemMessage.classList.remove('show');
    }, 4000);
}

function captureFrame() {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
}

async function performTask(endpoint, button, loadingText) {
    if (isScanning) return;
    isScanning = true;
    
    scanOverlay.classList.add('scanning');
    const originalText = button.innerText;
    button.innerText = loadingText;
    
    // Simulate biometric scan duration
    setTimeout(async () => {
        const imageData = captureFrame();
        
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            const result = await res.json();
            
            showMessage(result.message, result.success);
            
            if (result.success && endpoint === '/api/scan') {
                // If vault opens, dramatic effect
                // play unlock sound if added
            }
        } catch (err) {
            showMessage("NETWORK FAILURE. COM-LINK LOST.", false);
        } finally {
            isScanning = false;
            scanOverlay.classList.remove('scanning');
            button.innerText = originalText;
            updateStatus();
            updateLogs();
        }
    }, 2500);
}

btnRegister.addEventListener('click', () => performTask('/api/register', btnRegister, 'ENCODING BIOMETRICS...'));
btnScan.addEventListener('click', () => performTask('/api/scan', btnScan, 'VERIFYING IDENTITY...'));

btnLock.addEventListener('click', async () => {
    try {
        await fetch('/api/lock', { method: 'POST' });
        showMessage("VAULT INITIATING LOCKDOWNPROTOCOL", false);
        updateStatus();
        updateLogs();
    } catch (e) { console.error(e); }
});

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    setupWebcam();
    updateStatus();
    updateLogs(); 
    setInterval(updateLogs, 5000); 
});
