const photoModal = document.getElementById('photoModal');
const videoElement1 = document.getElementById('webcam1');
const captureBtn = document.getElementById('capture');
const recaptureBtn = document.getElementById('recapturePhoto');
const submitBtn = document.getElementById('submitPhoto');
const analyzeresult = document.getElementById('analyze-result');
const canvasElement = document.getElementById('photoCanvas');
const ctx = canvasElement.getContext('2d');
const shapeResult = document.getElementById('shape-result');
const shapeDescription = document.getElementById('shape-description');
const showResult = document.getElementById('show-result');
const glassesList = document.getElementById('glasses-list');
const progressBar = document.getElementById('p-bar');
const faceCamShape = document.getElementById('face-cam-shape');

let capturedImageData;
let stream1;
let glassy = [];

function openModal() {
    photoModal.classList.add('show');
    startWebcam1();
}

function closeModal() {
    photoModal.classList.remove('show');
    stopWebcam1();
}

async function startWebcam1() {
    try {
        stream1 = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement1.srcObject = stream1;
    } catch (err) {
        console.error("Webcam error:", err);
        alert("Could not access webcam.");
    }
}

function stopWebcam1() {
    if (stream1) {
        stream1.getTracks().forEach(track => track.stop());
        videoElement1.srcObject = null;
    }
}

captureBtn.onclick = () => {
    canvasElement.width = videoElement1.videoWidth;
    canvasElement.height = videoElement1.videoHeight;
    ctx.drawImage(videoElement1, 0, 0);
    capturedImageData = canvasElement.toDataURL('image/png');
    
    videoElement1.style.display = 'none';
    canvasElement.style.display = 'block';
    captureBtn.style.display = 'none';
    recaptureBtn.style.display = 'inline-block';
    submitBtn.style.display = 'inline-block';
};

recaptureBtn.onclick = () => {
    videoElement1.style.display = 'block';
    canvasElement.style.display = 'none';
    captureBtn.style.display = 'inline-block';
    recaptureBtn.style.display = 'none';
    submitBtn.style.display = 'none';
};

submitBtn.onclick = async () => {
    closeModal();
    analyzeresult.style.display = 'flex';
    
    // Animate progress bar
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        progressBar.style.width = progress + '%';
        if (progress >= 100) clearInterval(interval);
    }, 150);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: capturedImageData })
        });
        const data = await response.json();

        if (data.error) {
            alert(data.error);
            analyzeresult.style.display = 'none';
        } else {
            displayResults(data);
        }
    } catch (err) {
        console.error("Analysis error:", err);
        analyzeresult.style.display = 'none';
    }
};

function displayResults(data) {
    setTimeout(() => {
        analyzeresult.style.display = 'none';
        showResult.style.display = 'block';
        shapeResult.innerText = data.shape.toUpperCase();
        shapeDescription.innerText = data.probability;
        faceCamShape.src = `data:image/jpeg;base64,${data.faceimg}`;
        
        glassy = data.glasses;
        populateGlasses(data.glasses);
        showResult.scrollIntoView({ behavior: 'smooth' });
    }, 1000);
}

function populateGlasses(glasses) {
    glassesList.innerHTML = '';
    glasses.forEach(glass => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = `
            <img src="${glass.image_url}" alt="${glass.frame_name}">
            <h3>${glass.frame_name}</h3>
            <p>${glass.frame_type}</p>
            <button class="try-on-mini" onclick="openPopup('${glass.glass_model}')">
                Try On
            </button>
        `;
        glassesList.appendChild(card);
    });
}

// Reuse Popup Logic from script.js (Simplified here for standalone)
function openPopup(model) {
    const popup = document.getElementById("popup-tryon");
    popup.style.display = "block";
    startMainWebcam();
    if (window.load3dmodel) window.load3dmodel(model);
}

function closePopup() {
    const popup = document.getElementById("popup-tryon");
    popup.style.display = "none";
    stopMainWebcam();
    if (window.disposeModel) window.disposeModel();
}

let mainStream;
async function startMainWebcam() {
    mainStream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById('webcam').srcObject = mainStream;
}

function stopMainWebcam() {
    if (mainStream) mainStream.getTracks().forEach(t => t.stop());
}

window.openModal = openModal;
window.closeModal = closeModal;
window.openPopup = openPopup;
window.closePopup = closePopup;
