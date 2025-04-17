import { OrbitControls } from 'https://unpkg.com/three@0.128.0/examples/jsm/controls/OrbitControls.js';

// --- Config ---
const MAX_TIME_STEPS = 100;
const NODES_PER_STEP = 150; // Average number of nodes active at any time
const MAX_CONNECTIONS_PER_NODE = 3;
const NODE_LIFESPAN_RANGE = [20, 50]; // Min/max time steps a node exists
const CONNECTION_LIFESPAN_RANGE = [10, 30];
const SCENE_BOUNDS = 150; // How far nodes spread out
const ANIMATION_DURATION = 0.5; // GSAP animation speed (seconds)

// --- Global Vars ---
let scene, camera, renderer, controls;
let simulationData = []; // Stores data for each time step: [{ id, x, y, z, size, colorVal, connections: [targetId,...] }, ...]
let nodesMap = new Map(); // Map data ID to Three.js Mesh { mesh, data, connections: [lineMesh,...] }
let connectionsMap = new Map(); // Map connection ID (e.g., "sourceId_targetId") to Three.js Line { line, sourceId, targetId }
let currentTimestep = 0;
let isPlaying = false;
let playInterval;
let playSpeed = 5; // Lower is faster (interval delay = 1000 / speed)

// --- DOM Elements ---
const container = document.getElementById('container');
const timeSlider = document.getElementById('timeSlider');
const timeValue = document.getElementById('timeValue');
const playPauseBtn = document.getElementById('playPauseBtn');
const playSpeedSlider = document.getElementById('playSpeed');
const nodeCountDisplay = document.getElementById('nodeCount');
const connectionCountDisplay = document.getElementById('connectionCount');
const tooltip = document.getElementById('tooltip');

// --- D3 Scales ---
const sizeScale = d3.scaleLinear().domain([0, 1]).range([0.5, 5]); // Data value 0-1 to node size
const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // Assign color based on category/origin

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    // scene.fog = new THREE.Fog(0x000000, 50, 300); // Add subtle fog

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 100;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1, 500);
    pointLight.position.set(50, 50, 50);
    scene.add(pointLight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooths rotation

    // Generate Data
    console.log("Generating simulation data...");
    generateSimulationData();
    console.log("Data generation complete.");

    // Setup UI
    setupUI();

     // Add Raycaster for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseMove(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(Array.from(nodesMap.values()).map(n => n.mesh)); // Check only node meshes

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            const nodeData = nodesMap.get(intersectedObject.userData.id)?.data; // Retrieve data using ID stored in userData

            if (nodeData) {
                 tooltip.style.display = 'block';
                 tooltip.style.left = `${event.clientX + 10}px`;
                 tooltip.style.top = `${event.clientY + 10}px`;
                 tooltip.innerHTML = `
                    ID: ${nodeData.id}<br>
                    Strength: ${nodeData.size.toFixed(2)}<br>
                    Category: ${Math.round(nodeData.colorVal * 10)}
                 `;
                 // Optional: Highlight effect (e.g., slight scale up or emissive change)
                 // gsap.to(intersectedObject.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.1 });
            }
        } else {
            tooltip.style.display = 'none';
            // Optional: De-highlight any previously highlighted object
        }
    }
    window.addEventListener('mousemove', onMouseMove);


    // Event Listeners
    window.addEventListener('resize', onWindowResize);

    // Initial Scene Update
    updateScene(0);

    // Start Animation Loop
    animate();
}

// --- Data Simulation ---
function generateSimulationData() {
    simulationData = [];
    let activeNodes = []; // Nodes currently "alive" in the simulation { id, birthStep, deathStep, initialData }

    for (let t = 0; t < MAX_TIME_STEPS; t++) {
        let currentStepData = [];
        let currentActiveIds = new Set();

        // 1. Update existing nodes and check lifespan
        activeNodes = activeNodes.filter(node => {
            if (t >= node.deathStep) {
                return false; // Node dies
            }
            // Update node properties slightly (optional drift)
            node.initialData.x += (Math.random() - 0.5) * 2;
            node.initialData.y += (Math.random() - 0.5) * 2;
            node.initialData.z += (Math.random() - 0.5) * 2;
            // Clamp position
            node.initialData.x = Math.max(-SCENE_BOUNDS, Math.min(SCENE_BOUNDS, node.initialData.x));
            node.initialData.y = Math.max(-SCENE_BOUNDS, Math.min(SCENE_BOUNDS, node.initialData.y));
            node.initialData.z = Math.max(-SCENE_BOUNDS, Math.min(SCENE_BOUNDS, node.initialData.z));

            // Add to current step data
            currentStepData.push({ ...node.initialData });
            currentActiveIds.add(node.initialData.id);
            return true; // Node survives
        });

        // 2. Add new nodes if below target count
        while (activeNodes.length < NODES_PER_STEP) {
            const newNodeId = `node_${t}_${Math.random().toString(16).slice(2)}`;
            const birthStep = t;
            const deathStep = t + Math.floor(d3.randomInt(NODE_LIFESPAN_RANGE[0], NODE_LIFESPAN_RANGE[1])());
            const initialData = {
                id: newNodeId,
                x: d3.randomUniform(-SCENE_BOUNDS, SCENE_BOUNDS)(),
                y: d3.randomUniform(-SCENE_BOUNDS, SCENE_BOUNDS)(),
                z: d3.randomUniform(-SCENE_BOUNDS, SCENE_BOUNDS)(),
                size: Math.random(), // 0 to 1
                colorVal: Math.random(), // 0 to 1 (used for color scale)
                birthStep: birthStep,
                deathStep: deathStep,
                connections: [] // Connections will be added next
            };
            activeNodes.push({ id: newNodeId, birthStep, deathStep, initialData });
            currentStepData.push({ ...initialData });
             currentActiveIds.add(newNodeId);
        }

        // 3. Create/Update Connections for nodes in currentStepData
         currentStepData.forEach(nodeData => {
            nodeData.connections = []; // Reset connections for this timestep

            // Decide if this node should form new connections
            if (Math.random() < 0.3) { // 30% chance to try forming connections
                const potentialTargets = currentStepData.filter(other => other.id !== nodeData.id);
                d3.shuffle(potentialTargets); // Randomize potential targets

                let connectionsMade = 0;
                for (let i = 0; i < potentialTargets.length && connectionsMade < MAX_CONNECTIONS_PER_NODE; i++) {
                    const target = potentialTargets[i];
                    // Connect based on proximity (example criteria)
                     const dist = Math.sqrt(
                         (nodeData.x - target.x)**2 +
                         (nodeData.y - target.y)**2 +
                         (nodeData.z - target.z)**2
                     );

                     if (dist < SCENE_BOUNDS * 0.4) { // Connect if reasonably close
                        nodeData.connections.push(target.id);
                        connectionsMade++;
                    }
                }
            }
        });


        simulationData.push(currentStepData);
    }
}


// --- Scene Update Logic ---
function updateScene(timestep) {
    if (timestep < 0 || timestep >= simulationData.length) return;
    currentTimestep = timestep;

    const targetData = simulationData[timestep];
    const targetDataMap = new Map(targetData.map(d => [d.id, d]));
    const currentIds = new Set(targetDataMap.keys());
    const previousIds = new Set(nodesMap.keys());

    // --- Nodes ---

    // 1. Handle EXITING nodes (in nodesMap but not in targetData)
    previousIds.forEach(id => {
        if (!currentIds.has(id)) {
            const nodeObj = nodesMap.get(id);
            if (nodeObj && !nodeObj.isExiting) { // Check flag to prevent multiple exit animations
                nodeObj.isExiting = true;
                 // Also remove associated connections immediately visually
                 nodeObj.connections.forEach(line => removeConnectionMesh(line));
                 nodeObj.connections = [];

                gsap.to(nodeObj.mesh.scale, {
                    x: 0.01, y: 0.01, z: 0.01, // Shrink almost to zero
                    duration: ANIMATION_DURATION,
                    ease: "power1.in",
                    onComplete: () => {
                        scene.remove(nodeObj.mesh);
                        nodesMap.delete(id);
                        updateCounts(); // Update counts after removal
                    }
                });
                 gsap.to(nodeObj.mesh.material, {
                    opacity: 0,
                    duration: ANIMATION_DURATION,
                     ease: "power1.in",
                     // No onComplete needed here, scale handles removal
                });
            }
        }
    });

    // 2. Handle ENTERING and UPDATING nodes
    targetData.forEach(data => {
        const existingNode = nodesMap.get(data.id);

        if (existingNode && !existingNode.isExiting) {
            // UPDATE existing node
            existingNode.data = data; // Update stored data

            // Animate properties
            gsap.to(existingNode.mesh.position, {
                x: data.x, y: data.y, z: data.z,
                duration: ANIMATION_DURATION,
                ease: "sine.out"
            });
            const targetScale = sizeScale(data.size);
            gsap.to(existingNode.mesh.scale, {
                x: targetScale, y: targetScale, z: targetScale,
                duration: ANIMATION_DURATION,
                ease: "sine.out"
            });
            // Ensure material is fully opaque if it was fading out
             if (existingNode.mesh.material.opacity < 1) {
                 gsap.to(existingNode.mesh.material, { opacity: 1, duration: ANIMATION_DURATION / 2 });
             }
            // Animate color change (if necessary)
            const targetColor = new THREE.Color(colorScale(data.colorVal));
             if (!existingNode.mesh.material.color.equals(targetColor)) {
                 gsap.to(existingNode.mesh.material.color, {
                     r: targetColor.r, g: targetColor.g, b: targetColor.b,
                     duration: ANIMATION_DURATION,
                 });
             }

        } else if (!existingNode) {
            // ENTER new node
            const geometry = new THREE.SphereGeometry(1, 16, 16); // Base size 1, scaled later
            const material = new THREE.MeshStandardMaterial({
                color: colorScale(data.colorVal),
                transparent: true,
                opacity: 0, // Start invisible
                roughness: 0.6,
                metalness: 0.2
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(data.x, data.y, data.z);
            mesh.scale.set(0.01, 0.01, 0.01); // Start small
            mesh.userData = { id: data.id }; // Store ID for raycasting

            scene.add(mesh);
            const newNodeObj = { mesh: mesh, data: data, connections: [], isExiting: false };
            nodesMap.set(data.id, newNodeObj);

            // Animate entrance
            const targetScale = sizeScale(data.size);
            gsap.to(mesh.scale, {
                x: targetScale, y: targetScale, z: targetScale,
                duration: ANIMATION_DURATION,
                delay: Math.random() * 0.2, // Stagger entry slightly
                ease: "back.out(1.7)" // Overshoot effect
            });
            gsap.to(material, {
                opacity: 1,
                duration: ANIMATION_DURATION,
                 delay: Math.random() * 0.2,
                ease: "power1.inOut"
            });
        }
    });

    // --- Connections ---
    updateConnections(targetDataMap);

    // Update UI
    timeValue.textContent = timestep;
    timeSlider.value = timestep; // Sync slider if updated programmatically
    updateCounts();
}


function updateConnections(targetDataMap) {
    const currentConnectionIds = new Set(); // "sourceId_targetId"
    const existingConnectionIds = new Set(connectionsMap.keys());

     // --- Create / Update Connections ---
     targetDataMap.forEach(sourceNodeData => {
         const sourceNodeObj = nodesMap.get(sourceNodeData.id);
         if (!sourceNodeObj || sourceNodeObj.isExiting) return; // Skip if source doesn't exist or is leaving

         const currentTargetIds = new Set(sourceNodeData.connections);
         const previousTargetIds = new Set(sourceNodeObj.connections.map(line => line.userData.targetId));


         sourceNodeData.connections.forEach(targetId => {
             const targetNodeObj = nodesMap.get(targetId);
             // Ensure target node exists and is not exiting
             if (targetNodeObj && !targetNodeObj.isExiting) {
                 const connectionId = `${sourceNodeData.id}_${targetId}`;
                 currentConnectionIds.add(connectionId);

                 const existingConnection = connectionsMap.get(connectionId);

                 if (existingConnection) {
                     // UPDATE connection geometry (if nodes moved)
                     const sourcePos = sourceNodeObj.mesh.position;
                     const targetPos = targetNodeObj.mesh.position;
                     const points = [sourcePos, targetPos];
                     existingConnection.line.geometry.setFromPoints(points);
                     existingConnection.line.geometry.verticesNeedUpdate = true; // Deprecated, but might be needed depending on Three.js version / Line type
                     existingConnection.line.geometry.computeBoundingSphere(); // Important for visibility

                      // Ensure opacity is 1 if it was fading
                      if (existingConnection.line.material.opacity < 0.5) {
                           gsap.to(existingConnection.line.material, { opacity: 0.5, duration: ANIMATION_DURATION / 2 });
                      }

                 } else if (!existingConnection && !previousTargetIds.has(targetId)) { // Only create if truly new for this source
                     // ENTER new connection
                     const sourcePos = sourceNodeObj.mesh.position;
                     const targetPos = targetNodeObj.mesh.position;
                     const points = [sourcePos, targetPos];
                     const geometry = new THREE.BufferGeometry().setFromPoints(points);
                     const material = new THREE.LineBasicMaterial({
                         color: sourceNodeObj.mesh.material.color, // Match source node color
                         linewidth: 1, // Note: linewidth > 1 requires LineMaterial/LineGeometry2
                         transparent: true,
                         opacity: 0 // Start invisible
                     });
                     const line = new THREE.Line(geometry, material);
                     line.userData = { sourceId: sourceNodeData.id, targetId: targetId }; // Store IDs


                     scene.add(line);
                     const newConnection = { line: line, sourceId: sourceNodeData.id, targetId: targetId, isExiting: false };
                     connectionsMap.set(connectionId, newConnection);
                     sourceNodeObj.connections.push(line); // Link line to source node


                     // Animate entrance
                     gsap.to(material, {
                         opacity: 0.5, // Connections are more subtle
                         duration: ANIMATION_DURATION,
                          delay: ANIMATION_DURATION / 2 // Appear slightly after nodes
                     });
                 }
             }
         });
     });

     // --- Remove Old Connections ---
     existingConnectionIds.forEach(connId => {
         if (!currentConnectionIds.has(connId)) {
             const connectionObj = connectionsMap.get(connId);
              if (connectionObj && !connectionObj.isExiting) {
                   connectionObj.isExiting = true;
                    gsap.to(connectionObj.line.material, {
                        opacity: 0,
                        duration: ANIMATION_DURATION,
                        ease: "power1.in",
                        onComplete: () => {
                            removeConnectionMesh(connectionObj.line); // Use helper
                             connectionsMap.delete(connId);
                             updateCounts();
                        }
                    });
                }
         }
     });
}

// Helper to remove connection mesh and clean up node's connection list
function removeConnectionMesh(lineMesh) {
    if (!lineMesh) return;
    scene.remove(lineMesh);
    lineMesh.geometry.dispose();
    lineMesh.material.dispose();

    // Remove from the source node's connection array
    const sourceId = lineMesh.userData.sourceId;
    const targetId = lineMesh.userData.targetId;
     const sourceNodeObj = nodesMap.get(sourceId);
      if (sourceNodeObj) {
         sourceNodeObj.connections = sourceNodeObj.connections.filter(line => line !== lineMesh);
     }
}


// --- UI Setup & Handlers ---
function setupUI() {
    timeSlider.max = MAX_TIME_STEPS - 1;
    timeSlider.addEventListener('input', (e) => {
        pauseSimulation(); // Pause playback when scrubbing
        updateScene(parseInt(e.target.value));
    });

    playPauseBtn.addEventListener('click', togglePlayPause);

     playSpeedSlider.addEventListener('input', (e) => {
         playSpeed = parseInt(e.target.value);
         if (isPlaying) {
             // Restart interval with new speed
             pauseSimulation();
             startSimulation();
         }
     });
}

function togglePlayPause() {
    if (isPlaying) {
        pauseSimulation();
    } else {
        startSimulation();
    }
}

function startSimulation() {
    if (isPlaying) return;
    isPlaying = true;
    playPauseBtn.textContent = 'Pause';
    const interval = () => (1000 / playSpeed) ; // Calculate delay based on slider

    function step() {
         let nextTimestep = currentTimestep + 1;
         if (nextTimestep >= MAX_TIME_STEPS) {
             nextTimestep = 0; // Loop back
         }
         updateScene(nextTimestep);
         if (isPlaying) {
             playInterval = setTimeout(step, interval()); // Schedule next step
         }
     }
     step(); // Start the first step immediately
}

function pauseSimulation() {
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    clearTimeout(playInterval);
}

function updateCounts() {
    nodeCountDisplay.textContent = nodesMap.size;
    connectionCountDisplay.textContent = connectionsMap.size;
}


// --- Window Resize ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Only required if enableDamping or autoRotate is set
    renderer.render(scene, camera);
}

// --- Start ---
init();