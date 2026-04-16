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
const cardLighting = document.getElementById('cardLighting');
const climateStatus = document.getElementById('climateStatus');
const lightingStatus = document.getElementById('lightingStatus');

let isScanning = false;
let masterHistogram = null;

/* ---------------- INTERACTIVE SMART HOME SYSTEM ---------------- */

// Lighting Themes Logic
const themes = [
    { name: 'Muted Elegance', class: '', icon: '💡' },
    { name: 'Daylight Mode', class: 'theme-light', icon: '☀️' },
    { name: 'Midnight Neon', class: 'theme-neon', icon: '🌙' }
];
let themeIdx = 0;

cardLighting.addEventListener('click', () => {
    themeIdx = (themeIdx + 1) % themes.length;
    let newTheme = themes[themeIdx];
    
    document.body.className = newTheme.class; // Transform the entire website UI
    
    lightingStatus.innerText = `Mode: ${newTheme.name}`;
    cardLighting.querySelector('.card-icon').innerText = newTheme.icon;
    
    cardLighting.classList.add('pulse');
    setTimeout(() => cardLighting.classList.remove('pulse'), 300);
    
    addAuditLog(`Lighting Switched to ${newTheme.name}`, 'SUCCESS');
    if ('speechSynthesis' in window) {
        let msg = new SpeechSynthesisUtterance(`${newTheme.name} engaged.`);
        msg.rate = 1.0; speechSynthesis.speak(msg);
    }
});

// Climate Control Logic
const temperatures = [72, 68, 65, 76];
let tempIdx = 0;

cardClimate.addEventListener('click', () => {
    tempIdx = (tempIdx + 1) % temperatures.length;
    let newTemp = temperatures[tempIdx];
    
    climateStatus.innerText = `Status: ${newTemp}°F`;
    
    cardClimate.classList.add('pulse');
    setTimeout(() => cardClimate.classList.remove('pulse'), 300);
    
    addAuditLog(`Climate Adjusted to ${newTemp}°F`, 'SUCCESS');
    if ('speechSynthesis' in window) {
        let msg = new SpeechSynthesisUtterance(`Temperature set to ${newTemp} degrees.`);
        msg.rate = 1.0; speechSynthesis.speak(msg);
    }
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
    if (themeIdx !== 0) {
        document.body.className = themes[0].class;
        themeIdx = 0; lightingStatus.innerText = `Mode: ${themes[0].name}`;
        cardLighting.querySelector('.card-icon').innerText = themes[0].icon;
    }
    
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
