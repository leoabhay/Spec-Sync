import datetime
import os

import cv2
import numpy as np
from flask import Flask, render_template, jsonify, request, Response
from flask_cors import CORS
from flask_cors import cross_origin
import pymysql
import base64  # To handle binary data for .glb files
from werkzeug.utils import secure_filename
from wtforms import FileField
from io import BytesIO
from PIL import Image
from werkzeug.exceptions import RequestEntityTooLarge
import time
import mysql.connector

from deployment import predict_face_shape

image_bytes_global = None 

app = Flask(__name__)
# app = Flask(__name__, static_url_path='/static', static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 
CORS(app)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


facemap = {
    "Oval": " The oval face shape is considered the most balanced, with a rounded jawline and slightly narrower forehead. This face shape is versatile and works well with most frame types",
    "Round": "A round face has soft, curved lines with the width and length being roughly equal. The cheeks tend to be fuller, and the jawline is round.",
    "Oblong": "An oblong face is longer than it is wide, with a high forehead and long, straight cheekbones. The jawline is typically square or rounded.",
    "Square": "A square face has strong, angular features with a broad forehead, square jawline, and wide cheekbones. The overall shape is very angular.",
    "Heart" : "A heart-shaped face is characterized by a broad forehead, high cheekbones, and a pointed chin. This shape is narrower at the jawline than at the temples."
}

feature_boxes = [
    {
        "id": 1,
        "badge": "Aviator",
        "category": "sunglasses",
        "image": "/static/assets/glass-img/ray.avif",
        "title": "Alpha Aviator",
        "subtitle": "Essential Series",
        "model": "/static/models/meshglass.glb"
    },
    {
        "id": 2,
        "badge": "Oval",
        "category": "eyeglasses",
        "image": "/static/assets/glass-img/circle.jpg",
        "title": "Urban Circle",
        "subtitle": "Metro Collection",
        "model": "/static/models/glass.glb"
    },
    {
        "id": 3,
        "badge": "Rectangular",
        "category": "eyeglasses",
        "image": "/static/assets/glass-img/OIP.jpg",
        "title": "Structure Rect",
        "subtitle": "Formal Line",
        "model": "/static/models/glasses-10.glb"
    },
    {
        "id": 4,
        "badge": "Rectangular",
        "category": "sunglasses",
        "image": "/static/assets/glass-img/OIPs.png",
        "title": "Summer Shade",
        "subtitle": "Holiday Breeze",
        "model": "/static/models/glasses-5b.glb"
    },
    {
        "id": 5,
        "badge": "Round",
        "category": "eyeglasses",
        "image": "/static/assets/glass-img/round (867).jpg",
        "title": "Classic Round",
        "subtitle": "Vintage Style",
        "model": "/static/models/glasses-6.glb"
    },
    {
        "id": 6,
        "badge": "Over Sized",
        "category": "sunglasses",
        "image": "/static/assets/glass-img/sliderA.jpg",
        "title": "Bold Statement",
        "subtitle": "Celebrity Mode",
        "model": "/static/models/glasses-9b.glb"
    },
    {
        "id": 7,
        "badge": "New Arrival",
        "category": "eyeglasses",
        "image": "/static/assets/glass-img/sliderB.jpg",
        "title": "Futura Frame",
        "subtitle": "Modernist",
        "model": "/static/models/glasses-8b.glb"
    },
    {
        "id": 8,
        "badge": "Titanium",
        "category": "eyeglasses",
        "image": "/static/assets/glass-img/sliderC.jpg",
        "title": "Titan Lite",
        "subtitle": "Premium Metal",
        "model": "/static/models/glasses-11.glb"
    },
    {
        "id": 9,
        "badge": "Clear",
        "category": "eyeglasses",
        "image": "/static/assets/glass-img/sliderD.jpg",
        "title": "Crystal Clear",
        "subtitle": "Pure Series",
        "model": "/static/models/glasses-12a.glb"
    }
]

# MySQL configuration
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "1234",
    "database": "eyewear"
}

print('hello')

@app.errorhandler(RequestEntityTooLarge)
def handle_large_file(e):
    return jsonify({"error": "File is too large. Maximum size is 10 MB"}), 413

@app.route('/')
def home():
    return render_template('index.html',feature_boxes=feature_boxes) 

@app.route('/face-shape-identification')
def second_page():
    return render_template('faceshapefinder.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        global image_bytes_global
        # Extract the JSON data
        data = request.json  # Read JSON payload
        image_data = data.get('image')  # Extract Base64 image string
        
        if not image_data:
            print("No img")
            return jsonify({"message": "No image data received"}), 400

        # Decode the Base64 image
        header, encoded = image_data.split(",", 1)  # Remove the 'data:image/png;base64' prefix
        image_bytes = base64.b64decode(encoded)
        image_bytes_global = image_bytes
        # Save the image to the server
        image_path = os.path.join(UPLOAD_FOLDER, 'uploaded_image.png')
        with open(image_path, 'wb') as f:
            f.write(image_bytes)
            print(" image saved")
            
        
        iimg =  cv2.imread(image_path)
        result = predict_face_shape(iimg)   
        if 'error' in result: # If shape detection failed
            return jsonify({'error': 'No face detected. Please try again with a new image'}), 400
        elif 'shape' in result:  # If shape detected
            glasses = (check_db_connection(result['shape']))
            print(glasses)
          
            description = f"Your face shape is {result['shape']} with a probability of {result['probability']}%. "
            
            return jsonify({'shape': result['shape'], 'probability': description, 'glasses': glasses, 'faceimg': result['faceimg']}), 200
        
        return jsonify({"message": "Image successfully uploaded!", "path": image_path}), 200
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"message": f"Failed to process image: {str(e)}"}), 500

  
def check_db_connection(face_shape):
    try:
        # Establishing the connection to MySQL
        conn = mysql.connector.connect(
            host=db_config["host"],
            user=db_config["user"],
            password=db_config["password"],
            database=db_config["database"]
        )
        
        # If connection is successful, close the connection
        cursor = conn.cursor(dictionary=True)
        
        # Using MySQL JSON functions to search the `face_shapes` field
        query = """
        SELECT frame_name, price, frame_type, image_url, glass_model
        FROM frames
        WHERE JSON_CONTAINS(face_shapes, JSON_QUOTE(%s))
        """
        cursor.execute(query, (face_shape,))
        glasses = cursor.fetchall()
        cursor.close()
        conn.close()
        return glasses  
    except mysql.connector.Error as err:
        print(f"Database error: {err}. Returning mock data.")
        # Return mock data based on feature_boxes to prevent frontend from breaking
        mock_glasses = []
        for item in feature_boxes:
            mock_glasses.append({
                "frame_name": item["title"],
                "price": "N/A",
                "frame_type": item["badge"].lower(),
                "image_url": item["image"],
                "glass_model": item["model"]
            })
        return mock_glasses
    
      


if __name__ == '__main__':
    app.run(debug=True)
    