// --- Configuration ---
const PARTICLE_COUNT = 50000; // Number of particles (adjust for performance)
const PARTICLE_BASE_SIZE = 1.5;
const PARTICLE_SPREAD = 100; // Initial spread range
const MAX_SPREAD_FACTOR = 3.0; // How much volume increases spread
const HUE_SHIFT_SPEED = 0.05; // How fast color changes with volume

// --- Global Variables ---
let scene, camera, renderer, particles, particleGeometry, particleMaterial;
let analyser, dataArray; // For audio analysis
let audioContext;
let controls; // OrbitControls
let animationProps = { // Properties controlled by GSAP
    spreadFactor: 1.0,
    hue: 0.6, // Start with blue-ish
    pointSize: PARTICLE_BASE_SIZE
};
let isRunning = false;

// --- DOM Elements ---
const container = document.getElementById('container');
const infoElement = document.getElementById('info');
const startButton = document.getElementById('startButton');

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 150;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Particles
    createParticles();

    // Optional: OrbitControls for debugging navigation
    // controls = new THREE.OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);

    infoElement.textContent = 'Click Start to enable audio';
}

// --- Particle Creation ---
function createParticles() {
    particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const initialColor = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // Initial position (random sphere)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const radius = Math.random() * PARTICLE_SPREAD;

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);

        // Initial color (can be set later)
        initialColor.setHSL(animationProps.hue, 0.8, 0.6);
        colors[i3] = initialColor.r;
        colors[i3 + 1] = initialColor.g;
        colors[i3 + 2] = initialColor.b;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material
    particleMaterial = new THREE.PointsMaterial({
        size: animationProps.pointSize,
        vertexColors: true, // Use colors defined in geometry attributes
        sizeAttenuation: true, // Make particles smaller further away
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending, // Nice glow effect
        depthWrite: false // Avoid depth sorting issues with additive blending
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

// --- Audio Setup ---
async function setupAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Configure AnalyserNode
        analyser.fftSize = 256; // Power of 2 (32, 64, 128, ..., 2048)
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength); // Array to store frequency data

        infoElement.textContent = 'Audio input enabled. Make some noise!';
        startButton.style.display = 'none'; // Hide button after success
        isRunning = true;
        animate(); // Start animation loop only after audio setup

    } catch (err) {
        console.error('Error accessing microphone:', err);
        infoElement.textContent = 'Error: Could not access microphone. Please allow permission.';
        startButton.textContent = 'Retry Audio?'; // Allow retry
    }
}

// --- TensorFlow.js Face Detection Setup (Placeholder) ---
/*
async function setupWebcamAndFaceDetection() {
    infoElement.textContent = 'Loading Face Model...';
    const video = document.getElementById('webcamVideo');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }, // Request specific size
            audio: false
        });
        video.srcObject = stream;
        await new Promise((resolve) => { video.onloadedmetadata = resolve; });
        video.play();

        // Load the MediaPipe Facemesh package.
        await tf.setBackend('webgl'); // Use WebGL backend for performance
        const model = await faceLandmarksDetection.load(
            faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
            { maxFaces: 1 } // Detect only one face for simplicity
        );
        infoElement.textContent = 'Face Model Loaded. Detecting...';

        detectFaces(model, video); // Start detection loop

    } catch (err) {
        console.error("Error setting up webcam or face detection:", err);
        infoElement.textContent = 'Error: Webcam/Face Detection failed.';
    }
}

async function detectFaces(model, video) {
    if (!isRunning) return; // Stop if main loop isn't running

    const predictions = await model.estimateFaces({ input: video });

    if (predictions.length > 0) {
        // --- Data Mapping Example ---
        // predictions[0].scaledMesh contains landmark points [x, y, z]
        // Example: Calculate distance between specific landmarks (e.g., lips)
        const landmarks = predictions[0].scaledMesh;
        const upperLipTop = landmarks[13]; // Example index
        const lowerLipBottom = landmarks[14]; // Example index
        const lipDistance = Math.hypot(upperLipTop[0] - lowerLipBottom[0], upperLipTop[1] - lowerLipBottom[1]);

        // Map lipDistance to a particle parameter (e.g., size or color)
        let targetSize = PARTICLE_BASE_SIZE + lipDistance * 0.1; // Adjust mapping factor
        gsap.to(animationProps, { pointSize: targetSize, duration: 0.2 });

        // --- MORE MAPPING IDEAS ---
        // - Map distance between eyes to particle spread
        // - Map head tilt angle (calculate from key landmarks) to particle rotation/flow direction
        // - Map eyebrow height to color brightness
        // -------------------------

        // Example Info Update:
        // infoElement.textContent = `Lip Dist: ${lipDistance.toFixed(2)}`;

    } else {
         // Optional: Reset properties if no face detected
         gsap.to(animationProps, { pointSize: PARTICLE_BASE_SIZE, duration: 0.5 });
    }

    requestAnimationFrame(() => detectFaces(model, video)); // Loop detection
}
*/

// --- Animation Loop ---
function animate() {
    if (!isRunning) return; // Stop loop if not running

    requestAnimationFrame(animate);

    // 1. Get Audio Data
    let audioLevel = 0;
    if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray); // Get frequency data
        // Simple volume calculation: average frequency levels
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        audioLevel = sum / dataArray.length / 128.0; // Normalize to roughly 0-2 range
        audioLevel = Math.min(audioLevel, 2.0); // Clamp max value
    }

    // 2. Get Face Data (if integrated)
    // Face detection runs in its own loop (detectFaces) and updates animationProps via GSAP

    // 3. Map Input to Animation Properties using GSAP for smoothing
    let targetSpread = 1.0 + (audioLevel * (MAX_SPREAD_FACTOR - 1.0));
    let targetHue = (animationProps.hue + audioLevel * HUE_SHIFT_SPEED) % 1.0; // Shift hue based on volume

    gsap.to(animationProps, {
        spreadFactor: targetSpread,
        hue: targetHue,
        duration: 0.3, // Smooth transition duration
        ease: "power1.out"
    });

    // 4. Update Particles based on smoothed animationProps
    updateParticles();

    // Optional: Update controls
    // if (controls) controls.update();

    // Render
    renderer.render(scene, camera);
}

// --- Particle Update Logic ---
function updateParticles() {
    const positions = particleGeometry.attributes.position.array;
    const colors = particleGeometry.attributes.color.array;
    const time = Date.now() * 0.0005; // Simple time factor for movement

    const tempColor = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // Example: Make particles oscillate or move outwards based on spreadFactor
        // This is a simple example; more complex behavior (morphing, flow) requires more math
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        const originalDist = Math.sqrt(x * x + y * y + z * z);

        // Avoid division by zero for particle at center
        const normalizedDist = originalDist === 0 ? 1 : originalDist / PARTICLE_SPREAD;
        const scale = animationProps.spreadFactor * (1 + Math.sin(normalizedDist * 5 + time) * 0.1); // Add some wave motion

        // Recalculate position based on scale (simple outward expansion/contraction)
        if (originalDist > 0) { // Don't move the center particle if it exists
            positions[i3] = (x / originalDist) * PARTICLE_SPREAD * normalizedDist * scale;
            positions[i3 + 1] = (y / originalDist) * PARTICLE_SPREAD * normalizedDist * scale;
            positions[i3 + 2] = (z / originalDist) * PARTICLE_SPREAD * normalizedDist * scale;
        }


        // Update Color based on smoothed hue
        tempColor.setHSL(animationProps.hue, 0.8, 0.6);
        colors[i3] = tempColor.r;
        colors[i3 + 1] = tempColor.g;
        colors[i3 + 2] = tempColor.b;
    }

    // Tell Three.js to update the geometry attributes
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;

    // Update material size based on smoothed props (if not controlled by face detection)
    if (particleMaterial) {
        // Only update size if face detection isn't controlling it, or provide a combined logic
        // For now, audio affects spread/color, face detection (if added) affects size
        particleMaterial.size = animationProps.pointSize;
    }

    // Optional: Add overall rotation
    // particles.rotation.y += 0.001;
}


// --- Event Handlers ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

startButton.addEventListener('click', () => {
    if (!audioContext) { // Only setup audio context once
        setupAudio();
        // --- Uncomment the line below to ALSO start face detection ---
        // setupWebcamAndFaceDetection();
    }
});

// --- Start ---
init();
// Note: animate() is now called inside setupAudio() after permission is granted