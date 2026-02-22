import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

import * as THREE from 'three';
import { OrbitControls } from 'threeOrbitControls';
import { GLTFLoader } from "threeGLTFLoader";
// import { DrawingUtils } from "@mediapipe/tasks-vision";

const width = 640;
const height = 480;
// 3D model setup and animation
const canvas = document.getElementById('threeCanvas');
const mpcanvas = document.getElementById('mpCanvas');
const canvasCtx = mpcanvas.getContext('2d');
const videoElement = document.getElementById('webcam');
const videoEle = document.querySelector('video');


let animationFrameId;  // Variable to store the animation frame ID


const scene = new THREE.Scene();
const aspect = width / height; // Webcam aspect ratio
const camera = new THREE.PerspectiveCamera(78, aspect, 0.1, 1000);

camera.position.set(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(width, height);

// const helper = new THREE.CameraHelper(camera);
// scene.add(helper);

// const sceneHelper = new THREE.AxesHelper(5);
// scene.add(sceneHelper);



// Initialize shared data
window.faceTrackingData = { rotation: null, position: null };
// window.faceTrackingData = {
//     rotation: new THREE.Euler(0, 0, 0), // Initial rotation (in radians)
//     position: new THREE.Vector3(0, 1, 0), // Initial position
// };
window.faceWidthInScene = null;
window.faceDepth = null;
window.nosetip = { x: 1, y: 1, z: 1 };
window.eyeleft = { x: 1, y: 1, z: 1 };
window.eyeright = { x: 1, y: 1, z: 1 };
window.landmarkl = { x: 1, y: 1, z: 1 };
window.landmarkr = { x: 1, y: 1, z: 1 };
window.nosebridge = { x: 1, y: 1, z: 1 };
window.leftside = { x: 1, y: 1, z: 0 };
window.rightside = { x: 1, y: 1, z: 0 };
window.rightedge = { x: 1, y: 1, z: 0 };
window.leftedge = { x: 1, y: 1, z: 0 };
let matrixData;
let pd = null;
let rectData = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
};

let distace;
let state = 0;

// Webcam and canvas elements

// const canvasElement = document.getElementById('outputcam');
// const canvasCtx = canvasElement.getContext('2d');

let lastVideoTime = -1;

// Initialize MediaPipe vision task
async function initializeFaceLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        selfieMode: true
    });
}

let faceLandmark = await initializeFaceLandmarker();


function rotationMatrixToEulerAngles(matrix) {
    const sy = Math.sqrt(matrix[0][0] ** 2 + matrix[1][0] ** 2);
    const singular = sy < 1e-6;

    let x, y, z; // Euler angles

    if (!singular) {
        x = Math.atan2(matrix[2][1], matrix[2][2]);
        y = Math.atan2(-matrix[2][0], sy);
        z = Math.atan2(matrix[1][0], matrix[0][0]);
    } else {
        x = Math.atan2(-matrix[1][2], matrix[1][1]);
        y = Math.atan2(-matrix[2][0], sy);
        z = 0;
    }
    x = -x;
    return { roll: x, pitch: y, yaw: z }; // Angles in radians
}


function calculatepd(A, B, C, D) {
    let puppilarydistance = Math.sqrt((A - B) ** 2 + (C - D) ** 2);
    let leftside = B - puppilarydistance / 2;
    let rideside = A + puppilarydistance / 2;
    window.landmarkl = { x: leftside, y: 1, z: 1 };
    window.landmarkr = { x: rideside, y: 1, z: 1 };
    // console.log(window.landmarkl.x);
    leftside = leftside * width -100;
    rideside = rideside * width -100 ;
    puppilarydistance = puppilarydistance * width;
    console.log("pd= ", puppilarydistance);


   


    return {
        puppilarydistance,
        leftside,
        rideside
    };
}



// Prediction loop
function predict() {
    const nowInMs = Date.now();
    if (lastVideoTime !== videoElement.currentTime) {
        lastVideoTime = videoElement.currentTime;
        const result = faceLandmark.detectForVideo(videoElement, nowInMs);
        console.log("predicting");
        // for rotation and position
        if (result && result.facialTransformationMatrixes.length > 0) {
            const matrix = result.facialTransformationMatrixes[0];
            console.log('matrices real: ', matrix);

            //extracting rotation matrix from matrix data 
            let rotation_val = [
                [matrix.data[0], matrix.data[1], matrix.data[2]],
                [matrix.data[4], matrix.data[5], matrix.data[6]],
                [matrix.data[8], matrix.data[9], matrix.data[10]],
            ];
            console.log("rotation", rotation_val);
            let eulerAngle = rotationMatrixToEulerAngles(rotation_val);
            console.log("eulers values", eulerAngle);
            let position = { x: matrix.data[12], y: matrix.data[13], z: matrix.data[14] };
            window.faceTrackingData = { rotation: eulerAngle, position: position };
        }



        // for landmark  cordinate find
        if (result && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            console.log('landmark: ', landmarks);


            const noseTip = landmarks[195]; // Nose tip landmark
            // const noseTip = landmarks[1]; // Nose tip landmark
            const leftCheek = landmarks[234];
            const rightedge = landmarks[389];
            const lefteye = landmarks[468];
            const righteye = landmarks[473];
            const nosebridge = landmarks[168];

            // const pd = (righteye.x - lefteye.x) * width;
            // const puppilarydistance = Math.sqrt( (righteye.x - lefteye.x)**2 + (righteye.y - lefteye.y)**2) * width;
            let A, B;
            pd = calculatepd(righteye.x, lefteye.x, righteye.y, lefteye.y); 
            console.log("pd= ", pd.puppilarydistance);
            console.log("left side= ", pd.leftside);
            console.log("right side = ", pd.rideside);
            distace = Math.abs( pd.leftside - pd.rideside);
            console.log(distace, pd.leftside);

         
            window.leftside.x = (pd.leftside ) / (width);
            window.rightside.x  = (pd.rideside ) / (height);
            window.leftside.y = window.nosetip.y;
            window.rightside.y = window.nosetip.y;



           

            // window.landmark = {x: pd.leftside , y: lefteye.y}

            landmarks.forEach((landmark) => {
                landmark.x = 1 - landmark.x; // Flip the x coordinate
            });

            const pixelX = nosebridge.x * width;
            const pixelY = nosebridge.y * height;

            

            const drawingUtils = new DrawingUtils(canvasCtx);
            clearPreviousDrawings();

            // canvasCtx.beginPath();
            // // canvasCtx.arc(pixelX, pixelY, 2, 0, Math.PI * 2);
            // canvasCtx.rect(pixelX - pd.puppilarydistance / 2, pixelY, pd.puppilarydistance, 30);
            // // canvasCtx.fillStyle = 'yellow';
            // // canvasCtx.fill();
            // canvasCtx.closePath();

            // canvasCtx.beginPath();
            // canvasCtx.rect(pixelX - pd.puppilarydistance / 2, pixelY, pd.puppilarydistance, 30);
            // canvasCtx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Yellow with 30% opacity
            // canvasCtx.fill(); // Fill with transparency
            // canvasCtx.strokeStyle = 'yellow'; // Yellow border
            // canvasCtx.lineWidth = 2;
            // canvasCtx.stroke(); // Apply border
            // canvasCtx.closePath();


            rectData.x = pixelX - pd.puppilarydistance / 2;
            rectData.y = pixelY;
            rectData.width = pd.puppilarydistance;
            rectData.height = 40;

            //   drawingUtils.drawConnectors(
            //     landmarks,
            //     FaceLandmarker.FACE_LANDMARKS_TESSELATION,
            //     { color: "#C0C0C070", lineWidth: 1 }
            //   );

            //for nosetip:
            window.nosetip = { x: noseTip.x, y: noseTip.y, z: noseTip.z };
            window.eyeleft = { x: lefteye.x, y: lefteye.y, z: lefteye.z };
            window.eyeright = { x: righteye.x, y: righteye.y, z: righteye.z };
            window.nosebridge = { x: nosebridge.x, y: nosebridge.y, z: nosebridge.z };
            window.rightedge = { x: rightedge.x, y: rightedge.y, z: rightedge.z };



            // canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear previous drawings
            // drawPoint(canvasCtx, x, y)
        }

    }
    requestAnimationFrame(predict);
}


function clearPreviousDrawings() {
    canvasCtx.clearRect(0, 0, width, height);
}

let model = null;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;
let globalcenter = { x: 0, y: 0, z: 0 };
let boundingBox;
let size;
let aspectratioY;
let child;
let earpiece;
const gridhelper = new THREE.GridHelper(10, 10);
// scene.add(gridhelper);




const light = new THREE.DirectionalLight(0xffffff, 1); // Bright white light
light.position.set(5, 10, 7.5); // Position the light
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040); // Soft ambient light
scene.add(ambientLight);



// Add a plane to visualize the click area
const planeGeometry = new THREE.BoxGeometry(40, 40, 0.1);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xabaaaa, side: THREE.DoubleSide, visible: false });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.position.z = 0;
scene.add(plane);

// Raycaster for detecting mouse clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector3();



let currentModel = null;

export function disposeModel() {
    if (currentModel) {
        scene.remove(currentModel);

        // Traverse and dispose resources
        currentModel.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        currentModel.visible = !currentModel.visible;
        currentModel = null; // Remove reference
    }
    
    renderer.render(scene, camera); // Refresh scene
}

window.disposeModel = disposeModel;

// Load model

//need try catch since sometimes value might not be given
export function load3dmodel(value)
{
    disposeModel();
    const loader = new GLTFLoader();
    loader.load(value, (gltf) => {
        model = gltf.scene;
        // Add the model to the scene
        // model.scale.set(1, 1, 1);
        currentModel = gltf.scene;
        const bbox = new THREE.Box3().setFromObject(model); // Calculate bounding box
        size = new THREE.Vector3();
        bbox.getSize(size);
        aspectratioY = size.y / size.x;
        analyzeModel(model);
        scene.add(model);
    
        // modelscale();
    
    }, undefined, (error) => {
        console.error('An error occurred:', error);
    });
}

window.load3dmodel = load3dmodel;

function analyzeModel(model) {
    // Basic analysis to ensure all parts are visible by default
    model.traverse((child) => {
        if (child.isMesh) {
            child.visible = true;
            console.log('Mesh visible:', child.name);
        }
    });
}



const cube = createCube();
const cube1 = createCube();
const cube2 = createCube();
const cube3 = createCube();





// scene.add(cube);
// scene.add(cube1);
// scene.add(cube2);
// scene.add(cube3);


// cube.position.set(1, window.nosetip.y, window.nosetip.z);
// const boxHelper = new THREE.BoxHelper(cube, 0xff0000); // Red wireframe around the cube
// scene.add(boxHelper);

const screenWidth = window.innerWidth;  // The width of the viewport in pixels
const screenHeight = window.innerHeight;  // The height of the viewport in pixels

console.log(`Screen size: ${screenWidth}px ${screenHeight} px`);
// cube.applyMatrix4(matrixData);


camera.position.z = 5;

function updateCubePosition(landmark) {
    // const referenceWidth = 1432; // Reference screen width
    // const referenceHeight = 774; // Reference screen height

    // Convert Mediapipe nose coordinates to screen coordinates
    let screenX = (landmark.x) * width;
    let screenY = landmark.y * height;
    

  
    // Convert screen coordinates of mediapipe  to NDC of three js
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((screenX - rect.left) / width) * 2 - 1; // NDC X
    mouse.y = -((screenY - rect.top) / height) * 2 + 1; // NDC Y
    mouse.z = landmark.z;
    // Set up raycaster from camera through the projected point
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(plane);

    if (intersects.length > 0) {
        // Extract intersection point
        const intersectPoint = intersects[0].point;



        // Dynamically adjust error factors
        const errorX = 6.47;
        const errorY = 2.38;
        // const errorX = 0;
        // const errorY = 0;

        const ndcPoint = intersectPoint.clone().project(camera); // Project world point to NDC


        intersectPoint.x = intersectPoint.x + errorX;
        intersectPoint.y = intersectPoint.y - errorY;
        // Optionally, update the cube's position to the intersection point
        return intersectPoint;
        // cube.position.lerp(intersectPoint, 0.1);
    } else {
     
        return null;
    }


}





function updateCube(size) {
    if (!model) return;

    let { rotation, _ } = window.faceTrackingData;

    if (window.faceTrackingData.rotation) {
        // cube.rotation.set(rotation.roll, rotation.pitch, rotation.yaw);
        model.rotation.set(rotation.roll, rotation.pitch, rotation.yaw);
    }



    const nose_intersectPoint = updateCubePosition(window.nosetip);
    if (nose_intersectPoint != null) {
        cube.position.copy(nose_intersectPoint);
        // camera.position.copy(nose_intersectPoint);
        // camera.position.z = 5;
    }

    
    //pd values calculation 
    const lefteye_intersectPoint = updateCubePosition(window.leftside);
    if (lefteye_intersectPoint != null) { cube1.position.copy(lefteye_intersectPoint); }

    const righteye_intersectPoint = updateCubePosition(window.rightside);
    if (righteye_intersectPoint != null) { cube2.position.copy(righteye_intersectPoint); }

  
    //  for depth in right ear
    // const rightear_intersectionPoint = updateCube(window.rideside);
    // if (rightear_intersectionPoint != null)
    // {
         
    // }


    

    const scalefactorx =  Math.abs(lefteye_intersectPoint.x - righteye_intersectPoint.x) -0.8  ;
    const scalefactory = scalefactorx * aspectratioY /2 ;

    // model.scale.x =  scalefactorx  ;
    cube.scale.x = scalefactorx ;
    

// Apply normalization factor to the model
    

    

    // const nose_bridgepoint = updateCubePosition(window.nosebridge);
    // if (nose_bridgepoint != null)
    // {cube3.position.copy(nose_bridgepoint);}

    if (size) {
        const finalScale = (scalefactorx / size.x) * 1.1; // Slight multiplier for better fit
        model.scale.set(finalScale, finalScale, finalScale);
    }

    const modelposition = updateCubePosition(window.nosebridge); // Anchor to bridge instead of tip
    if (modelposition != null) { 
        model.position.copy(modelposition);
        // Subtle offset to bring glasses slightly forward
        model.position.z += 0.5; 
        projectTo2D(modelposition);
        IOU();
    }



   
   
    // Render the updated scene
    // scene.add(cube);
    // scene.add(cube1);
    // scene.add(cube2);
    scene.add(model);

    renderer.render(scene, camera);
}


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (model) {
        updateCube(size);
    }
    renderer.render(scene, camera);
}

function projectTo2D(object3D) {
    let vector = object3D;
   
    // vector.setFromMatrixPosition(object3D.matrixWorld); // Get world position
    vector.project(camera); // Project to 2D screen space

    let x = (vector.x * 0.5 + 0.5);  // Convert to screen pixels
    let y = (1 - (vector.y * 0.5 + 0.5)); // Flip Y for screen coordinates
    console.log("checking");
    console.log(window.nosebridge.x,x);

    // let noseTip = faceLandmarks[1]; // Assuming landmark 1 is nose tip (adjust as needed)

    let dx = window.nosebridge.x - x;
    let dy = window.nosebridge.y - y;
    // let dy = glasses2D.y - noseTip.y;

    let LE = Math.sqrt(dx * dx + dy * dy);

    
}

function project2D(object3D) {
    let vector = object3D;
    // vector.setFromMatrixPosition(object3D.matrixWorld); // Get world position
    vector.project(camera); // Project to 2D screen space

    let x = (vector.x * 0.5 + 0.5) * width;  // Convert to screen pixels
    let y = (1 - (vector.y * 0.5 + 0.5)) * height ; // Flip Y for screen coordinates

    return { x, y };
}

function getBoundingBox(object3D) {
    let bbox = new THREE.Box3().setFromObject(object3D); // Get 3D bounding box
    let corners = [
        new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
        new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
    ];

    let screenCorners = corners.map(corner => project2D(corner));
    return {
        x: screenCorners[0].x ,
        y: screenCorners[0].y ,
        width: Math.abs(screenCorners[1].x - screenCorners[0].x),
        height: Math.abs(screenCorners[1].y - screenCorners[0].y)
    };
}

function computeIoU(glassesBBox, faceBBox) {
    let xA = Math.max(glassesBBox.x, faceBBox.x);
    let yA = Math.max(glassesBBox.y, faceBBox.y);
    let xB = Math.min(glassesBBox.x + glassesBBox.width, faceBBox.x + faceBBox.width);
    let yB = Math.min(glassesBBox.y + glassesBBox.height, faceBBox.y + faceBBox.height);

    let interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    let glassesArea = glassesBBox.width * glassesBBox.height;
    let faceArea = faceBBox.width * faceBBox.height;

    let IoU = 1.8* interArea / (glassesArea + faceArea - interArea);
    return IoU;
}


function IOU()
{
    let glassesBBox = getBoundingBox(model);
    
    console.log(`x = ${glassesBBox.x}  , ${rectData.x}`);
    console.log(`y = ${glassesBBox.y}, ${rectData.y}`);
    console.log(`width = ${glassesBBox.width}, ${rectData.width}`);
    console.log(`height = ${glassesBBox.height}, ${rectData.height}`);

    let IoU_scores = computeIoU(glassesBBox,rectData);
    // print("IoU:", IoU_scores.mean(), "+/-", IoU_scores.std())
  
}



function createCube() {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const materials = [
        new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff }), // Red
        new THREE.MeshBasicMaterial({ color: Math.random() * 0x00ff00 }), // Green
        new THREE.MeshBasicMaterial({ color: Math.random() * 0x0000ff }), // Blue
        new THREE.MeshBasicMaterial({ color: Math.random() * 0xffff00 }), // Yellow
        new THREE.MeshBasicMaterial({ color: Math.random() * 0xff00ff }), // Magenta
        new THREE.MeshBasicMaterial({ color: Math.random() * 0x00ffff })  // Cyan
    ];
    return new THREE.Mesh(geometry, materials);
}

function updatePlanePosition() {
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);  // Get the direction the camera is facing
    const planeDistance = 5;  // The fixed distance from the camera
    plane.position.copy(camera.position).add(cameraDirection.multiplyScalar(planeDistance));  // Position the plane
    plane.rotation.copy(camera.rotation);  // Match the plane's rotation to the camera's
}

// Setup prediction listener
export function setupPredictionListener() {
    videoElement.addEventListener('play', () => {
        console.log("Video started playing. Starting prediction...");
        predict();
        animate();
        // alert("running");
    });
    console.log("Prediction listener set up. Waiting for video to play...");
}

window.setupPredictionListener = setupPredictionListener;