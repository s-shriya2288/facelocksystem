import os
import base64
import cv2
import numpy as np
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Fallback in-memory storage for Vercel
SYSTEM_LOCKED = True
ACCESS_LOGS = []
REGISTERED_HIST = None # To store biometric signature

cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

def log_access(action, status, user="Unknown"):
    global ACCESS_LOGS
    timestamp = datetime.utcnow().isoformat() + "Z"
    ACCESS_LOGS.insert(0, {'timestamp': timestamp, 'action': action, 'status': status, 'user': user})
    ACCESS_LOGS = ACCESS_LOGS[:15]

def extract_face_hist(image_b64):
    image_data = image_b64.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    if len(faces) == 0:
        return None

    # Get largest face
    faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
    x, y, w, h = faces[0]
    face_img = img[y:y+h, x:x+w]
    face_img = cv2.resize(face_img, (100, 100))
    
    # Calculate 3D Color Histogram for structural/light comparison
    hist = cv2.calcHist([face_img], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    cv2.normalize(hist, hist)
    return hist

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'is_locked': SYSTEM_LOCKED,
        'has_registered_identity': REGISTERED_HIST is not None
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    return jsonify({'logs': ACCESS_LOGS})

@app.route('/api/register', methods=['POST'])
def register_face():
    global REGISTERED_HIST
    data = request.json
    if 'image' not in data:
        return jsonify({'error': 'No image provided'}), 400

    try:
        hist = extract_face_hist(data['image'])
        if hist is None:
            return jsonify({'success': False, 'message': 'NO FACE DETECTED. BIOMETRIC ENCODING FAILED.'})

        REGISTERED_HIST = hist
        log_access('Identity Registration', 'GRANTED', 'Vault Master')
        return jsonify({'success': True, 'message': 'BIOMETRIC SIGNATURE ENCODED SECURELY.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scan', methods=['POST'])
def scan_face():
    global SYSTEM_LOCKED
    data = request.json
    
    if REGISTERED_HIST is None:
        return jsonify({'success': False, 'message': 'NO MASTER IDENTITY IN VAULT MEMORY.'})

    try:
        hist = extract_face_hist(data['image'])
        if hist is None:
            log_access('Vault Access Attempt', 'DENIED', 'Unknown Entity')
            return jsonify({'success': False, 'message': 'NO FACE DETECTED. AREA SECURE.'})

        # Compare Histograms using Correlation calculation
        similarity = cv2.compareHist(REGISTERED_HIST, hist, cv2.HISTCMP_CORREL)
        
        # 0.6 is a balanced threshold for histograms
        if similarity > 0.60:
            SYSTEM_LOCKED = False
            log_access('Vault Access Attempt', 'GRANTED', 'Vault Master')
            return jsonify({'success': True, 'message': f'ACCESS GRANTED. MATCH RATING: {int(similarity*100)}%', 'match': True})
        else:
            log_access('Vault Access Attempt', 'DENIED', f'Unknown (Match: {int(similarity*100)}%)')
            return jsonify({'success': False, 'message': f'INTRUDER DETECTED. MATCH RATING: {int(similarity*100)}%', 'match': False})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lock', methods=['POST'])
def lock_system():
    global SYSTEM_LOCKED
    SYSTEM_LOCKED = True
    log_access('Vault Lockdown', 'LOCKED', 'System Admin')
    return jsonify({'success': True, 'is_locked': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
