import * as THREE from 'three';
// Import GSAP if needed directly, or use the global `gsap`
// import RAPIER from 'path/to/rapier3d/pkg'; // Adjust path based on how you get Rapier

// --- Global Variables ---
let scene, camera, renderer, controls; // Add OrbitControls for navigation
let physicsWorld, eventQueue;
let renderObjects = []; // Store { threeMesh, physicsBody, type: 'rope'/'nebula' }
let tempLine; // For drawing rope preview
let dragStartPoint = null;
let grabbedObject = null; // Info about the grabbed object and constraint
let clock = new THREE.Clock();

// --- Constants ---
const RAPIER_PATH = 'https://cdn.skypack.dev/@dimforge/rapier3d-compat@0.11.2'; // Example CDN path

// --- UI Elements ---
const uiContainer = document.getElementById('ui-container');
const pulseBtn = document.getElementById('pulse-btn');
const clearBtn = document.getElementById('clear-btn');
const loadingIndicator = document.getElementById('loading-indicator');

// --- Initialization ---
async function init() {
  // Basic Three.js Setup
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 30;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lighting & Environment
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(50, 50, 50);
  scene.add(pointLight);
  createCosmicDust(); // Add background particles

  // Load Physics Engine (Rapier Example)
  try {
    const RAPIER = await import(RAPIER_PATH);
    await RAPIER.init(); // Initialize the Wasm module

    let gravity = { x: 0.0, y: -9.81, z: 0.0 }; // Or less for a floaty feel
    physicsWorld = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true); // For collision events if needed

    loadingIndicator.style.display = 'none';
    uiContainer.style.display = 'block';

    // Setup floor/bounds (optional invisible colliders)
    // createBounds(); 

    // Setup Event Listeners
    setupEventListeners();

    // Start the loop
    animate();
  } catch (error) {
    console.error("Failed to load Rapier physics:", error);
    loadingIndicator.textContent = "Error loading physics engine.";
  }
}

// --- Physics & Object Creation ---
function createSoftRope(start, end) {
  // --- THIS IS THE COMPLEX PART ---
  // Use Rapier's SoftBody (or Ammo's btSoftBody) API
  // 1. Define nodes (vertices) along the line between start and end.
  // 2. Define links (springs) between adjacent nodes.
  // 3. Add the soft body to the physicsWorld.
  // 4. Pin the start and end nodes (using constraints or setting mass to 0).
  // 5. Create a corresponding Three.js Line or TubeGeometry.
  // 6. Store references in renderObjects.

  console.log("Creating rope from", start, "to", end);
  // Placeholder: Replace with actual Rapier/Ammo soft body rope creation
  // Example structure:
  // const ropeSoftBody = physicsWorld.createSoftBody(/* ... params ... */);
  // const ropeMesh = new THREE.Line(...) or new THREE.TubeGeometry(...);
  // scene.add(ropeMesh);
  // renderObjects.push({ threeMesh: ropeMesh, physicsBody: ropeSoftBody, type: 'rope' });
}

function createNebulaCore(position) {
  // --- ALSO COMPLEX ---
  // Use Rapier's SoftBody (or Ammo's btSoftBody) API for volumetric bodies
  // 1. Define nodes for a sphere-like structure (e.g., icosphere vertices).
  // 2. Define links/springs between nodes to maintain shape but allow deformation.
  // 3. Add pressure properties if supported/desired.
  // 4. Add the soft body to the physicsWorld.
  // 5. Create a corresponding Three.js Mesh (e.g., IcosahedronGeometry).
  // 6. Apply custom shader material.
  // 7. Store references in renderObjects.

  console.log("Creating nebula at", position);
  // Placeholder: Replace with actual Rapier/Ammo soft body creation
  // Example structure:
  // const nebulaSoftBody = physicsWorld.createSoftBody(/* ... cluster params ... */);
  // const nebulaMaterial = new THREE.ShaderMaterial({ /* custom shaders */ });
  // const nebulaMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 2), nebulaMaterial);
  // nebulaMesh.position.copy(position); // Initial position
  // scene.add(nebulaMesh);
  // renderObjects.push({ threeMesh: nebulaMesh, physicsBody: nebulaSoftBody, type: 'nebula' });
}

function createCosmicDust() {
  const particles = 5000;
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < particles; i++) {
    positions.push((Math.random() - 0.5) * 200); // x
    positions.push((Math.random() - 0.5) * 200); // y
    positions.push((Math.random() - 0.5) * 200); // z
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xaaaaaa,
    size: 0.1,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true
  });
  const dust = new THREE.Points(geometry, material);
  scene.add(dust);
}

// --- Interaction ---
function setupEventListeners() {
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  pulseBtn.addEventListener('click', emitPulse);
  clearBtn.addEventListener('click', clearScene);
}

function getMouseWorldPosition(event) {
  // Convert mouse screen coordinates to 3D world coordinates (requires raycasting)
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Intersect with a conceptual plane at z=0 or based on context
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Adjust plane as needed
  const intersectPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersectPoint);
  return intersectPoint;
}


function onMouseDown(event) {
  const intersectPoint = getMouseWorldPosition(event);
  if (!intersectPoint) return;

  // Check if clicking on an existing object (needs raycasting against object meshes)
  // If grabbing:
  //   grabbedObject = { objectInfo, constraint: physicsWorld.addImpulseJoint(...) };
  //   Use GSAP for visual feedback
  // else (start drawing rope):
  dragStartPoint = intersectPoint.clone();
  // Create temporary line for visual feedback
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([dragStartPoint, dragStartPoint]);
  tempLine = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(tempLine);
  // GSAP animation for line appearance?
  gsap.from(tempLine.material, { opacity: 0, duration: 0.3 });
}

function onMouseMove(event) {
  if (dragStartPoint && tempLine) {
    const currentPoint = getMouseWorldPosition(event);
    if (currentPoint) {
      tempLine.geometry.setFromPoints([dragStartPoint, currentPoint]);
      tempLine.geometry.attributes.position.needsUpdate = true;
    }
  } else if (grabbedObject) {
    // Update constraint target position based on mouse movement
  }
}

function onMouseUp(event) {
  if (dragStartPoint && tempLine) { // Finish drawing rope
    scene.remove(tempLine);
    tempLine.geometry.dispose();
    tempLine.material.dispose();
    tempLine = null;

    const endPoint = getMouseWorldPosition(event);
    if (endPoint && dragStartPoint.distanceTo(endPoint) > 1.0) { // Min length
      createSoftRope(dragStartPoint, endPoint);
    } else {
      // If drag was very short, treat as a click to spawn nebula
      createNebulaCore(dragStartPoint);
    }
    dragStartPoint = null;

  } else if (grabbedObject) { // Release object
    // physicsWorld.removeConstraint(grabbedObject.constraint);
    // grabbedObject = null;
    // GSAP animation for release feedback?
  }
}

function emitPulse() {
  console.log("Emitting Pulse!");
  // Iterate through all physics bodies (especially soft bodies)
  // Calculate direction vector from pulse center to body center-of-mass/node
  // Apply an impulse or force using body.applyImpulse() or body.addForce()
  // Use GSAP to briefly animate a visual effect (e.g., expanding sphere)
  gsap.to(someVisualPulseObject.scale, { x: 10, y: 10, z: 10, duration: 0.5, ease: "power2.out", onComplete: () => {/* reset scale */ } });
}

function clearScene() {
  console.log("Clearing Scene");
  renderObjects.forEach(obj => {
    scene.remove(obj.threeMesh);
    if (obj.threeMesh.geometry) obj.threeMesh.geometry.dispose();
    if (obj.threeMesh.material) {
      if (Array.isArray(obj.threeMesh.material)) {
        obj.threeMesh.material.forEach(m => m.dispose());
      } else {
        obj.threeMesh.material.dispose();
      }
    }
    // CRITICAL: Remove the physics body from the world
    // physicsWorld.removeSoftBody(obj.physicsBody); // Adjust for Rapier/Ammo API
  });
  renderObjects = [];
  // Remove constraints if any are tracked globally
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  // 1. Step the Physics World
  physicsWorld.step(eventQueue);
  // eventQueue.drainCollisionEvents((handle1, handle2, started) => { /* handle collisions */ });

  // 2. Update Three.js Meshes from Physics State
  renderObjects.forEach(obj => {
    const physicsSoftBody = obj.physicsBody;
    const threeMesh = obj.threeMesh;

    // --- CRITICAL SYNC LOGIC ---
    // Get the deformed vertex/node positions from physicsSoftBody
    // (API differs significantly between Ammo and Rapier)
    // Example (conceptual - API will vary):
    // const positions = physicsSoftBody.getVertexPositions(); // Get array of vertex data
    // const threeGeometry = threeMesh.geometry;
    // const threePositions = threeGeometry.attributes.position;
    //
    // for (let i = 0; i < positions.length; i++) {
    //    threePositions.setXYZ(i, positions[i].x, positions[i].y, positions[i].z);
    // }
    // threePositions.needsUpdate = true; 
    // threeGeometry.computeVertexNormals(); // Important for lighting if deformed
  });

  // Optional: Add subtle background forces/movement
  // applyBackgroundForces(deltaTime); 

  // 3. Render the Scene
  renderer.render(scene, camera);
}

// --- Start Everything ---
init();