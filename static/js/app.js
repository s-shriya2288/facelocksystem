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

// Client-side Memory for Serverless Environment
let masterHistogram = null;
let isVaultLocked = true;
let accessLogs = [];

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

function updateStatusUI() {
    if (isVaultLocked) {
        lockStatus.className = 'status-indicator status-locked';
        lockStatus.querySelector('.status-text').innerText = 'VAULT SECURED';
    } else {
        lockStatus.className = 'status-indicator status-unlocked';
        lockStatus.querySelector('.status-text').innerText = 'VAULT OPENED';
    }

    if (masterHistogram !== null) {
        hasIdentity.className = 'badge active';
        hasIdentity.innerText = "MASTER BIOMETRIC LOADED";
    } else {
        hasIdentity.className = 'badge';
        hasIdentity.innerText = "NO MASTER BIOMETRIC SET";
    }
}

function updateLogsUI() {
    logList.innerHTML = '';
    accessLogs.forEach(log => {
        const div = document.createElement('div');
        let logClass = 'locked';
        if (log.status === 'GRANTED') logClass = 'granted';
        if (log.status === 'DENIED') logClass = 'denied';
        
        div.className = `log-item ${logClass}`;
        
        div.innerHTML = `
            <div class="log-time">[${log.time}] SYSTEM LOG</div>
            <div>>> ${log.action}</div>
            <div>>> ENTITY: ${log.entity}</div>
            <div>>> STATUS: ${log.status}</div>
        `;
        logList.appendChild(div);
    });
}

function addLog(action, status, entity) {
    const time = new Date().toLocaleTimeString();
    accessLogs.unshift({time, action, status, entity});
    if (accessLogs.length > 15) accessLogs.pop();
    updateLogsUI();
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
        let msgToSpeek = msg.replace(/[^a-zA-Z 0-9]/g, "");
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

async function handleRegister(button) {
    if (isScanning) return;
    isScanning = true;
    scanOverlay.classList.add('scanning');
    button.innerText = 'ENCODING BIOMETRICS...';
    
    setTimeout(async () => {
        const imageData = captureFrame();
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            const result = await res.json();
            
            showMessage(result.message, result.success);
            
            if (result.success) {
                masterHistogram = result.histogram; // Save identity securely in local client state!
                addLog('Identity Matrix Set', 'GRANTED', 'Vault Master');
            } else {
                addLog('Matrix Calibration', 'DENIED', 'Unknown Entity');
            }
        } catch (err) {
            showMessage("NETWORK FAILURE. COM-LINK LOST.", false);
        } finally {
            isScanning = false;
            scanOverlay.classList.remove('scanning');
            button.innerText = '1. SET MASTER IDENTITY';
            updateStatusUI();
        }
    }, 2500);
}

async function handleScan(button) {
    if (isScanning) return;
    isScanning = true;
    scanOverlay.classList.add('scanning');
    button.innerText = 'VERIFYING IDENTITY...';
    
    setTimeout(async () => {
        const imageData = captureFrame();
        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData, master_histogram: masterHistogram })
            });
            const result = await res.json();
            
            showMessage(result.message, result.success);
            
            if (result.match) {
                isVaultLocked = false;
                addLog('Vault Access Override', 'GRANTED', 'Vault Master');
            } else {
                addLog('Vault Access Attempt', 'DENIED', 'Unauthorized Sector Breach');
            }
        } catch (err) {
            showMessage("NETWORK FAILURE. COM-LINK LOST.", false);
        } finally {
            isScanning = false;
            scanOverlay.classList.remove('scanning');
            button.innerText = '2. REQUEST VAULT ACCESS';
            updateStatusUI();
        }
    }, 2500);
}

btnRegister.addEventListener('click', () => handleRegister(btnRegister));
btnScan.addEventListener('click', () => handleScan(btnScan));

btnLock.addEventListener('click', () => {
    isVaultLocked = true;
    showMessage("VAULT SECURED. LOCKDOWN PROTOCOL ACTIVE.", false);
    addLog('Manual Lockdown Trigger', 'LOCKED', 'System Admin');
    updateStatusUI();
});

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    setupWebcam();
    updateStatusUI();
    updateLogsUI(); 
});
