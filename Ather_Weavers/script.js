import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';

// Global variables
let scene, camera, renderer, controls;
let world, bodies = [];
let mouseConstraint = null;
let selectedBody = null;
let lastMousePos = new THREE.Vector3();

// Initialize Three.js scene
function initThree() {
    console.log("Initializing Three.js...");
    
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Camera setup
    camera.position.set(0, 5, 10);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // Grid helper
    const grid = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
    scene.add(grid);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    console.log("Three.js initialized successfully");
}

// Initialize Rapier physics
async function initPhysics() {
    // Create physics world
    world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

    // Create ground
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1, 10.0);
    world.createCollider(groundColliderDesc);

    // Add event listeners
    document.getElementById('addSphere').addEventListener('click', addSphere);
    document.getElementById('addCube').addEventListener('click', addCube);
    document.getElementById('clear').addEventListener('click', clearObjects);
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Hide loading screen
    document.getElementById('loading').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
}

// Add a sphere to the scene
function addSphere() {
    const radius = 0.5;
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        5,
        (Math.random() - 0.5) * 6
    );

    // Create Three.js mesh
    const geometry = new THREE.SphereGeometry(radius);
    const material = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        metalness: 0.3,
        roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    scene.add(mesh);

    // Create Rapier rigid body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Create Rapier collider
    const colliderDesc = RAPIER.ColliderDesc.ball(radius);
    world.createCollider(colliderDesc, rigidBody);

    // Store body and mesh
    bodies.push({ mesh, body: rigidBody });
}

// Add a cube to the scene
function addCube() {
    const size = 1;
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        5,
        (Math.random() - 0.5) * 6
    );

    // Create Three.js mesh
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        metalness: 0.3,
        roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    scene.add(mesh);

    // Create Rapier rigid body
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z);
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Create Rapier collider
    const colliderDesc = RAPIER.ColliderDesc.cuboid(size/2, size/2, size/2);
    world.createCollider(colliderDesc, rigidBody);

    // Store body and mesh
    bodies.push({ mesh, body: rigidBody });
}

// Clear all objects from the scene
function clearObjects() {
    for (const body of bodies) {
        scene.remove(body.mesh);
        world.removeRigidBody(body.body);
    }
    bodies = [];
}

// Mouse interaction helpers
function getRayCastPoint(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, camera);
    
    // Create Rapier ray
    const origin = raycaster.ray.origin;
    const direction = raycaster.ray.direction;
    
    const ray = new RAPIER.Ray(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: direction.x, y: direction.y, z: direction.z }
    );
    
    // Cast ray
    const hit = world.castRay(ray, 100.0, true);
    if (hit) {
        const point = ray.pointAt(hit.toi);
        return { point, body: hit.collider.parent() };
    }
    return null;
}

function onMouseDown(event) {
    const hit = getRayCastPoint(event);
    if (hit && !hit.body.isFixed()) {
        selectedBody = hit.body;
        lastMousePos.copy(hit.point);
    }
}

function onMouseMove(event) {
    if (selectedBody) {
        const hit = getRayCastPoint(event);
        if (hit) {
            const velocity = new THREE.Vector3()
                .copy(hit.point)
                .sub(lastMousePos)
                .multiplyScalar(50); // Adjust strength

            selectedBody.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
            lastMousePos.copy(hit.point);
        }
    }
}

function onMouseUp() {
    selectedBody = null;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Step physics world
    world.step();

    // Update mesh positions
    for (const body of bodies) {
        const position = body.body.translation();
        const rotation = body.body.rotation();
        
        body.mesh.position.set(position.x, position.y, position.z);
        body.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }

    // Update controls
    controls.update();

    // Render scene
    renderer.render(scene, camera);
}

// Initialize everything
async function init() {
    try {
        console.log("Starting initialization...");
        
        // Initialize Three.js first
        initThree();
        console.log("Three.js initialized");
        
        // Initialize RAPIER
        console.log("Initializing RAPIER...");
        await RAPIER.init();
        console.log("RAPIER initialized");
        
        // Initialize physics
        await initPhysics();
        console.log("Physics initialized");
        
        // Start animation loop
        animate();
        console.log("Animation loop started");
        
    } catch (error) {
        console.error("Initialization failed:", error);
        document.getElementById('loading').textContent = 'Failed to initialize: ' + error.message;
        document.getElementById('loading').style.color = 'red';
    }
}

// Start the application
console.log("Script loaded, starting initialization...");
init();