import base64
import mtcnn
from mtcnn.mtcnn import MTCNN
import os 
import cv2
import tensorflow as tf
from tensorflow.keras.models import load_model
import matplotlib.pyplot as plt 
import numpy as np 
import pickle

y_label_dict = {0: 'Heart', 1: 'Oblong', 2: 'Oval', 3: 'Round', 4: 'Square'}
detector = MTCNN()  # creates detector  

current_dir = os.path.dirname(os.path.abspath(__file__))
transfer_file = os.path.join(current_dir, '..', 'Trained Data', 'saved_models', 'vgg16-face-1.h5')
# Normalize path for compatibility
transfer_file = os.path.normpath(transfer_file)
model = tf.keras.models.load_model(transfer_file)


def crop_and_resize(image, target_w=224, target_h=224):
    '''this function crop & resize images to target size by keeping aspect ratio'''
    if image.ndim == 2:
        img_h, img_w = image.shape             # for Grayscale will be   img_h, img_w = img.shape
    elif image.ndim == 3:
        img_h, img_w, channels = image.shape   # for RGB will be   img_h, img_w, channels = img.shape
    target_aspect_ratio = target_w/target_h
    input_aspect_ratio = img_w/img_h

    if input_aspect_ratio > target_aspect_ratio:
        resize_w = int(input_aspect_ratio*target_h)
        resize_h = target_h
        img = cv2.resize(image, (resize_w , resize_h))
        crop_left = int((resize_w - target_w)/2)  ## crop left/right equally
        crop_right = crop_left + target_w
        new_img = img[:, crop_left:crop_right]
    if input_aspect_ratio < target_aspect_ratio:
        resize_w = target_w
        resize_h = int(target_w/input_aspect_ratio)
        img = cv2.resize(image, (resize_w , resize_h))
        crop_top = int((resize_h - target_h)/4)   ## crop the top by 1/4 and bottom by 3/4 -- can be changed
        crop_bottom = crop_top + target_h
        new_img = img[crop_top:crop_bottom, :]
    if input_aspect_ratio == target_aspect_ratio:
        new_img = cv2.resize(image, (target_w, target_h))

    return new_img



def extract_face(img, target_size=(224,224)):

           
    # 1. detect faces in an image
      
    results = detector.detect_faces(img)
    
    if not results:
        print(" No face detected please upload clear image ")
        return None
         
    else:
        x1, y1, width, height = results[0]['box']
        x2, y2 = x1+width, y1+height
        face = img[y1:y2, x1:x2]  # this is the face image from the bounding box before expanding bbox

        # 2. expand the top & bottom of bounding box by 10 pixels to ensure it captures the whole face
        adj_h = 10

        #assign value of new y1
        if y1-adj_h <10:
            new_y1=0
        else:
            new_y1 = y1-adj_h

        #assign value of new y2    
        if y1+height+adj_h < img.shape[0]:
            new_y2 = y1+height+adj_h
        else:
            new_y2 = img.shape[0]
        new_height = new_y2 - new_y1

        # 3. crop the image to a square image by setting the width = new_height and expand the box to new width
        adj_w = int((new_height-width)/2)    

        #assign value of new x1
        if x1-adj_w < 0:
            new_x1=0
        else:
            new_x1 = x1-adj_w

        #assign value of new x2
        if x2+adj_w > img.shape[1]:
            new_x2 = img.shape[1]
        else:
            new_x2 = x2+adj_w
        new_face = img[new_y1:new_y2, new_x1:new_x2]  # face-cropped square image based on original resolution

        # 4. resize image to the target pixel size
        sqr_img = cv2.resize(new_face, target_size)   
        return sqr_img



def predict_face_shape(img_array):
    
    result = {}
    try:
       
        face_img = extract_face(img_array) 
        
        if face_img is not None:    
            new_img = cv2.cvtColor(face_img,cv2.COLOR_BGR2RGB)         
            # convert the image for modelling
            _, buffer = cv2.imencode('.jpg', face_img)
            face_base64 = base64.b64encode(buffer).decode('utf-8')
            test_img = np.array(new_img, dtype=float)
            test_img = test_img/255
            test_img = np.array(test_img).reshape(1, 224, 224, 3)  
            # make predictions
            pred = model.predict(test_img)        
            label = np.argmax(pred,axis=1)
        
            shape = y_label_dict[label[0]]
            print(f'Your face shape is {shape}')
            pred = np.max(pred)
            probability = np.around(pred*100,2)
            probab = str(probability)
            result["shape"] = shape
            result["probability"] = probab
            result["faceimg"] = face_base64

        else:
            result["error"] = "Please try again with new img"
        # plt.imshow(new_img)
    except Exception as e:
        print(f'Oops!  Something went wrong.  Please try again.')
        print(e)
    
    return result    



# img =  cv2.imread( r"img url")

# predict_face_shape(img)