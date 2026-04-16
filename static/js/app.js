const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const btnRegister = document.getElementById('btnRegister');
const btnScan = document.getElementById('btnScan');
const btnLock = document.getElementById('btnLock');
const cameraWrapper = document.getElementById('cameraWrapper');
const systemMessage = document.getElementById('systemMessage');
const authLayer = document.getElementById('authLayer');
const homeLayer = document.getElementById('homeLayer');
const logList = document.getElementById('logList');

// Interactive Smart Cards
const cardClimate = document.getElementById('cardClimate');
const climateStatus = document.getElementById('climateStatus');

let isScanning = false;
let masterHistogram = null;

/* ---------------- INTERACTIVE SMART HOME SYSTEM ---------------- */

// Lighting Hub Switches Logic
const switchMain = document.getElementById('switchMain');
const switchNeon = document.getElementById('switchNeon');
const switchFlood = document.getElementById('switchFlood');

function updateLightingTheme() {
    if (switchNeon.checked) {
        document.body.className = 'theme-neon';
    } else if (switchMain.checked) {
        document.body.className = 'theme-light';
    } else {
        document.body.className = '';
    }
}

function handleSwitch(name, element) {
    element.addEventListener('change', () => {
        updateLightingTheme();
        const state = element.checked ? 'ON' : 'OFF';
        addAuditLog(`${name} turned ${state}`, 'SUCCESS');
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let msg = new SpeechSynthesisUtterance(`${name} ${state}.`);
            msg.rate = 1.1; speechSynthesis.speak(msg);
        }
    });
}

handleSwitch('Main overhead lighting', switchMain);
handleSwitch('Neon ambience', switchNeon);
handleSwitch('Exterior floods', switchFlood);

// Climate Control Logic
let currentTemp = 72;
const tempDown = document.getElementById('tempDown');
const tempUp = document.getElementById('tempUp');

function setTemperature(amount) {
    currentTemp += amount;
    climateStatus.innerText = `${currentTemp}°F`;
    
    cardClimate.classList.add('pulse');
    setTimeout(() => cardClimate.classList.remove('pulse'), 300);
    
    addAuditLog(`Climate Adjusted to ${currentTemp}°F`, 'SUCCESS');
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop overlap
        let msg = new SpeechSynthesisUtterance(`${currentTemp} degrees.`);
        msg.rate = 1.1; speechSynthesis.speak(msg);
    }
}

tempDown.addEventListener('click', (e) => {
    e.stopPropagation();
    setTemperature(-1);
});

tempUp.addEventListener('click', (e) => {
    e.stopPropagation();
    setTemperature(1);
});

/* ------------------------------------------------------------- */


async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        video.srcObject = stream;
    } catch (err) {
        showMessage("Camera Offline. Please connect optical sensor.", false);
    }
}

function showMessage(msg, isSuccess = null) {
    systemMessage.innerText = msg;
    
    cameraWrapper.classList.remove('glow-success', 'glow-error');
    if (isSuccess === true) {
        systemMessage.style.color = 'var(--success)';
        cameraWrapper.classList.add('glow-success');
    } else if (isSuccess === false) {
        systemMessage.style.color = 'var(--danger)';
        cameraWrapper.classList.add('glow-error');
    } else {
        systemMessage.style.color = 'var(--accent)';
    }
    
    if ('speechSynthesis' in window) {
        let msgToSpeek = msg.replace(/[^a-zA-Z 0-9.]/g, "");
        const utterance = new SpeechSynthesisUtterance(msgToSpeek);
        utterance.rate = 1.0; utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
    }
}

function enterVault() {
    authLayer.classList.add('slide-up');
    homeLayer.classList.add('active');
    if ('speechSynthesis' in window) {
        let msg = new SpeechSynthesisUtterance("Welcome home. Vault sequence complete.");
        msg.rate = 1.0; speechSynthesis.speak(msg);
    }
}

function secureVault() {
    authLayer.classList.remove('slide-up');
    homeLayer.classList.remove('active');
    
    // Reset lighting to elegant dark on exit
    switchMain.checked = false;
    switchNeon.checked = false;
    updateLightingTheme();
    
    showMessage("System Secured. Awaiting Biometric Validation.", null);
}

function captureFrame() {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
}

function addAuditLog(action, status) {
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = `
        <span>${action} <strong>[${status}]</strong></span>
        <span class="log-time">${time}</span>
    `;
    logList.prepend(div);
}

async function handleRegister(button) {
    if (isScanning) return;
    isScanning = true;
    cameraWrapper.classList.add('scanning');
    button.innerText = 'Analyzing...';
    
    setTimeout(async () => {
        const imageData = captureFrame();
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            const result = await res.json();
            
            if (result.success) {
                masterHistogram = result.histogram;
                showMessage(result.message, true);
                addAuditLog('Master Identity Registered', 'SUCCESS');
            } else {
                showMessage("Biometric Registration Failed.", false);
                addAuditLog('Master Identity Registration', 'FAILED');
            }
        } catch (err) { showMessage("Network Error.", false); } 
        finally {
            setTimeout(() => {
                isScanning = false;
                cameraWrapper.classList.remove('scanning', 'glow-success', 'glow-error');
                button.innerText = 'Set Master Face';
                if (!result?.success) showMessage("Awaiting Biometric Validation.", null);
            }, 3000);
        }
    }, 2000);
}

async function handleScan(button) {
    if (isScanning) return;
    isScanning = true;
    cameraWrapper.classList.add('scanning');
    button.innerText = 'Validating...';
    
    setTimeout(async () => {
        const imageData = captureFrame();
        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData, master_histogram: masterHistogram })
            });
            const result = await res.json();
            
            if (result.match) {
                showMessage("Access Granted.", true);
                addAuditLog('Vault Entry Authorized', 'GRANTED');
                setTimeout(() => { enterVault(); }, 1500); 
            } else {
                showMessage("Access Denied. Unknown Identity.", false);
                addAuditLog('Vault Entry Attempt', 'DENIED');
            }
        } catch (err) { showMessage("Network Error.", false); } 
        finally {
            setTimeout(() => {
                isScanning = false;
                cameraWrapper.classList.remove('scanning', 'glow-success', 'glow-error');
                button.innerText = 'Unlock Home';
                if (!authLayer.classList.contains('slide-up')) showMessage("Awaiting Biometric Validation.", null);
            }, 3000);
        }
    }, 2000);
}

btnRegister.addEventListener('click', () => handleRegister(btnRegister));
btnScan.addEventListener('click', () => handleScan(btnScan));

btnLock.addEventListener('click', () => {
    secureVault();
    addAuditLog('Vault Locked Manually', 'SECURED');
});

window.addEventListener('DOMContentLoaded', () => { setupWebcam(); });
