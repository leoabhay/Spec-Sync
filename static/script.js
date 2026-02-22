// Utility for smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Menu Toggle
function togglemenu() {
    const navbarMid = document.querySelector('.navbar.mid');
    navbarMid.classList.toggle('active');
}

// Category Filtering logic
document.addEventListener('DOMContentLoaded', function () {
    const filterTabs = document.querySelectorAll('.filter-tab');
    const featureBoxes = document.querySelectorAll('.feature-box');

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab UI
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const filterValue = tab.getAttribute('data-filter');

            featureBoxes.forEach(box => {
                const category = box.getAttribute('data-category');
                if (filterValue === 'all' || category === filterValue) {
                    box.style.display = 'block';
                } else {
                    box.style.display = 'none';
                }
            });
        });
    });

    // Hero section image slider
    let currentIndex = 1;
    const totalImages = 3;
  
    function toggleImages() {
        const currentImg = document.getElementById(`slide-${currentIndex}`);
        if (currentImg) currentImg.classList.remove('active');
        currentIndex = currentIndex % totalImages + 1;
        const nextImg = document.getElementById(`slide-${currentIndex}`);
        if (nextImg) nextImg.classList.add('active');
    }
  
    setInterval(toggleImages, 5000);

    // Mini Try On button logic
    document.querySelectorAll(".zoom-icon").forEach(button => {
        button.addEventListener("click", function () {
            const featureBox = this.closest(".feature-box");
            const modelSrc = featureBox.dataset.model || "No Model Available";
            openPopup(modelSrc);
        });
    });
});

// Carousel Scroll
function scrollCarousel(direction) {
    const viewport = document.querySelector('.carousel-viewport');
    const scrollAmount = 400; // Adjusted for card + gap
    viewport.scrollBy({
        left: scrollAmount * direction,
        behavior: 'smooth'
    });
}

// Webcam controls
let stream = null;
const videoElement = document.getElementById('webcam');

async function startWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" }
        });
        if (videoElement) {
            videoElement.srcObject = stream;
            console.log("Webcam connected");
            if (window.setupPredictionListener) {
                window.setupPredictionListener();
            }
        }
    } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Webcam access denied. Please allow camera permissions.');
    }
}

async function stopWebcam() {
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        if (videoElement) videoElement.srcObject = null;
    }
}

function openPopup(value) {
    const popup = document.getElementById("popup-tryon");
    if (popup) {
        popup.style.display = "block";
        document.body.style.overflow = "hidden"; // Prevent scrolling
        startWebcam();
        if (typeof window.load3dmodel === "function") {
            window.load3dmodel(value);
        }
    }
}

function closePopup() {
    const popup = document.getElementById("popup-tryon");
    if (popup) {
        popup.style.display = "none";
        document.body.style.overflow = "auto";
        if (typeof window.disposeModel === "function") {
            window.disposeModel();
        }
        stopWebcam();
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
});