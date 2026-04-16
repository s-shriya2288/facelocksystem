import os
import base64
import cv2
import numpy as np
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Fallback in-memory storage for Vercel (Serverless ephemeral environment requirement)
# On Vercel, the disk is entirely Read-Only except for /tmp which is severely constrained. 
SYSTEM_LOCKED = True
ACCESS_LOGS = []

# Ensure Haar Cascade is available
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

def log_access(action, status, user="Unknown"):
    global ACCESS_LOGS
    timestamp = datetime.utcnow().isoformat() + "Z"
    ACCESS_LOGS.insert(0, {'timestamp': timestamp, 'action': action, 'status': status, 'user': user})
    ACCESS_LOGS = ACCESS_LOGS[:15]

def set_lock_state(is_locked):
    global SYSTEM_LOCKED
    SYSTEM_LOCKED = is_locked

def get_lock_state():
    return SYSTEM_LOCKED

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({'is_locked': get_lock_state()})

@app.route('/api/logs', methods=['GET'])
def get_logs():
    return jsonify({'logs': ACCESS_LOGS})

@app.route('/api/scan', methods=['POST'])
def scan_face():
    data = request.json
    if 'image' not in data:
        return jsonify({'error': 'No image provided'}), 400

    try:
        # Parse base64
        image_data = data['image'].split(',')[1]
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Detect faces
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    if len(faces) > 0:
        authorized = True
        user = "Authorized Resident"
        
        if authorized:
            set_lock_state(False)
            log_access('Face Scan', 'GRANTED', user)
            return jsonify({'success': True, 'message': 'Access Granted. Welcome home!', 'faces_detected': len(faces), 'user': user})
    else:
        log_access('Face Scan', 'DENIED', 'No Face Detected')
        return jsonify({'success': False, 'message': 'No face detected. Please look at the camera.', 'faces_detected': len(faces) if 'faces' in locals() else 0})

@app.route('/api/lock', methods=['POST'])
def lock_system():
    set_lock_state(True)
    log_access('Manual Override', 'LOCKED', 'Admin')
    return jsonify({'success': True, 'is_locked': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
