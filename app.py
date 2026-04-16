import os
import base64
import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# State is now passed via API logic so Vercel Serverless containers don't lose data
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

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

@app.route('/api/register', methods=['POST'])
def register_face():
    data = request.json
    if 'image' not in data:
        return jsonify({'error': 'No image provided'}), 400

    try:
        hist = extract_face_hist(data['image'])
        if hist is None:
            return jsonify({'success': False, 'message': 'NO FACE DETECTED. BIOMETRIC ENCODING FAILED.'})

        # Return vector list to the decentralized frontend storage
        return jsonify({'success': True, 'message': 'BIOMETRIC SIGNATURE ENCODED SECURELY.', 'histogram': hist.tolist()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scan', methods=['POST'])
def scan_face():
    data = request.json
    
    if 'master_histogram' not in data or data['master_histogram'] is None:
        return jsonify({'success': False, 'message': 'NO MASTER IDENTITY IN VAULT MEMORY.'})

    try:
        hist = extract_face_hist(data['image'])
        if hist is None:
            return jsonify({'success': False, 'message': 'NO FACE DETECTED. AREA SECURE.'})

        # Generate math correlation
        registered_hist = np.array(data['master_histogram'], dtype=np.float32)
        similarity = cv2.compareHist(registered_hist, hist, cv2.HISTCMP_CORREL)
        
        # 0.6 is a balanced threshold for histograms
        if similarity > 0.60:
            return jsonify({'success': True, 'message': f'ACCESS GRANTED. IDENTITY MATRIC RATING: {int(similarity*100)}%', 'match': True})
        else:
            return jsonify({'success': False, 'message': f'INTRUDER DETECTED. MATRIX MISMATCH RATING: {int(similarity*100)}%', 'match': False})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
