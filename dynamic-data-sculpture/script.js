// --- Global Variables ---
let scene, camera, renderer, controls;
let nodesGroup, linksGroup;
let nodeMeshes = {}; // Store mesh objects { id: mesh }
let linkMeshes = {}; // Store line objects { id: line }
let simulationData = []; // Will hold data for each time step
let currentTimeStep = 0;
const NUM_TIME_STEPS = 5;
const NUM_NODES = 50;
const SPREAD = 100; // How spread out the nodes are initially

// Initialize clock at the top level
const clock = new THREE.Clock();

// --- D3 Scales ---
const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // Colors based on category
const sizeScale = d3.scaleLinear().domain([0, 1]).range([0.5, 3]); // Node size based on value

// --- Advanced Visual Features ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredNode = null;
let hoveredNodeLabel = null;
let nodeLabels = {};

// --- Advanced Features ---
let stats = null;
let visualizationMode = 'default';
let nodeSizeMultiplier = 1;
let globalLinkOpacity = 0.5;
let animationSpeedFactor = 1;
let clusters = [];

// Function to safely initialize Stats
function initStats() {
    try {
        if (typeof Stats !== 'undefined') {
            stats = new Stats();
            stats.showPanel(0); // 0: fps, 1: ms, 2: mb
            stats.dom.style.position = 'absolute';
            stats.dom.style.left = '10px';
            stats.dom.style.top = '10px';
            document.body.appendChild(stats.dom);
            stats.dom.style.display = 'none';
            return true;
        }
    } catch (e) {
        console.warn('Stats.js not available:', e);
        // Hide stats UI if Stats.js isn't available
        const statsDiv = document.getElementById('stats');
        if (statsDiv) {
            statsDiv.style.display = 'none';
        }
        const toggleStatsBtn = document.getElementById('toggleStats');
        if (toggleStatsBtn) {
            toggleStatsBtn.style.display = 'none';
        }
    }
    return false;
}

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827); // Match Tailwind bg-gray-900

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 150;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('container').appendChild(renderer.domElement);

    // Initialize Stats safely
    initStats();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xaaaaaa); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(50, 50, 100);
    scene.add(directionalLight);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 500;

    // Groups for organization
    nodesGroup = new THREE.Group();
    linksGroup = new THREE.Group();
    scene.add(nodesGroup);
    scene.add(linksGroup);

    // Generate Data
    simulationData = generateSyntheticData(NUM_NODES, NUM_TIME_STEPS, SPREAD);

    // Create Initial Visualization
    createVisualization(simulationData[0]);

    // Setup UI and Advanced Features
    setupUI();
    setupAdvancedFeatures();
    setupAdvancedControls();

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);

    // Start Animation Loop
    animate();

    console.log('Initialization complete');
}

// --- Data Generation ---
function generateSyntheticData(numNodes, numSteps, spread) {
    const dataOverTime = [];
    const fixedPositions = []; // Store initial positions

    // Generate initial fixed positions and categories
    for (let i = 0; i < numNodes; i++) {
        fixedPositions.push({
            x: (Math.random() - 0.5) * spread * 2,
            y: (Math.random() - 0.5) * spread * 2,
            z: (Math.random() - 0.5) * spread * 2,
            category: Math.floor(Math.random() * 10) // Assign a random category (0-9)
        });
    }

    // Generate data for each time step
    for (let t = 0; t < numSteps; t++) {
        const nodes = [];
        const links = [];
        const nodeIds = new Set(); // Keep track of nodes in this step

        // Generate nodes for this time step
        for (let i = 0; i < numNodes; i++) {
            // Randomly decide if a node exists in this step (e.g., 90% chance)
            if (Math.random() < 0.95 || t === 0) {
                const node = {
                    id: `node-${i}`,
                    x: fixedPositions[i].x + Math.sin(t * 0.5 + i) * 5, // Slight wobble over time
                    y: fixedPositions[i].y + Math.cos(t * 0.4 + i) * 5,
                    z: fixedPositions[i].z + Math.sin(t * 0.6 + i) * 4,
                    value: Math.random(), // Random value for size (0 to 1)
                    category: fixedPositions[i].category // Fixed category for color
                };
                nodes.push(node);
                nodeIds.add(node.id);
            }
        }

        // Generate links for this time step (simple random connections)
        const availableNodeIds = Array.from(nodeIds);
        const numLinks = Math.floor(availableNodeIds.length * 0.8); // Number of links relative to nodes
        for (let i = 0; i < numLinks; i++) {
            if (availableNodeIds.length < 2) break; // Need at least 2 nodes for a link

            let sourceIndex = Math.floor(Math.random() * availableNodeIds.length);
            let targetIndex = Math.floor(Math.random() * availableNodeIds.length);
            // Ensure source and target are different
            while (targetIndex === sourceIndex) {
                targetIndex = Math.floor(Math.random() * availableNodeIds.length);
            }

            const sourceId = availableNodeIds[sourceIndex];
            const targetId = availableNodeIds[targetIndex];
            const linkId = `${sourceId}-${targetId}`; // Simple link ID

            // Avoid duplicate links (e.g., nodeA-nodeB and nodeB-nodeA, or multiple nodeA-nodeB)
            // A more robust check would sort IDs first: `${[sourceId, targetId].sort().join('-')}`
            if (!links.some(l => (l.source === sourceId && l.target === targetId) || (l.source === targetId && l.target === sourceId))) {
                links.push({
                    id: linkId,
                    source: sourceId,
                    target: targetId,
                    strength: Math.random() * 0.5 + 0.5 // Random link strength (0.5 to 1.0)
                });
            }
        }

        dataOverTime.push({ nodes, links });
    }
    return dataOverTime;
}


// --- Create 3D Objects ---
function createVisualization(initialData) {
    // Clear existing meshes if recreating
    clearGroups();
    nodeMeshes = {};
    linkMeshes = {};

    // Node Geometry & Material (reusable)
    const nodeGeometry = new THREE.SphereGeometry(1, 16, 16); // Radius 1, detail level

    // Create Nodes
    initialData.nodes.forEach(node => {
        const nodeMaterial = new THREE.MeshStandardMaterial({
            color: colorScale(node.category),
            metalness: 0.3,
            roughness: 0.6,
        });
        const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
        mesh.position.set(node.x, node.y, node.z);
        const initialScale = sizeScale(node.value);
        mesh.scale.set(initialScale, initialScale, initialScale);
        mesh.userData = {
            id: node.id,
            value: node.value,
            category: node.category
        };

        nodesGroup.add(mesh);
        nodeMeshes[node.id] = mesh;
    });

    // Create Links
    initialData.links.forEach(link => {
        createOrUpdateLink(link, initialData.nodes); // Use helper function
    });
}

// Helper to create or update a single link line
function createOrUpdateLink(link, nodesData) {
    const sourceNode = nodesData.find(n => n.id === link.source);
    const targetNode = nodesData.find(n => n.id === link.target);

    // Only draw link if both nodes exist in this time step
    if (sourceNode && targetNode) {
        const points = [
            new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
            new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
        ];

        if (linkMeshes[link.id]) {
            // Update existing link geometry
            linkMeshes[link.id].geometry.setFromPoints(points);
            linkMeshes[link.id].geometry.verticesNeedUpdate = true; // Important!
            // Optionally animate material properties if they change
            gsap.to(linkMeshes[link.id].material, {
                opacity: 1.0, // Fade in if it was previously hidden
                duration: 0.3
            });
        } else {
            // Create new link
            const linkGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const linkMaterial = new THREE.LineBasicMaterial({
                color: 0xaaaaaa, // Gray color for links
                linewidth: 1, // Note: linewidth > 1 may not work on all platforms
                transparent: true,
                opacity: 0.5 // Slightly transparent
            });
            const line = new THREE.Line(linkGeometry, linkMaterial);
            line.userData = { id: link.id, sourceId: link.source, targetId: link.target }; // Store data

            linksGroup.add(line);
            linkMeshes[link.id] = line;
        }
    } else if (linkMeshes[link.id]) {
        // If link exists but one node is gone, hide it (or remove it)
        gsap.to(linkMeshes[link.id].material, {
            opacity: 0, // Fade out
            duration: 0.3,
            onComplete: () => {
                // Optional: Can set line.visible = false after fade
            }
        });
    }
}

// --- Update Visualization State ---
function updateVisualization(timeStepIndex) {
    if (timeStepIndex < 0 || timeStepIndex >= simulationData.length) return;

    currentTimeStep = timeStepIndex;
    const currentData = simulationData[timeStepIndex];
    const nodesById = new Map(currentData.nodes.map(d => [d.id, d]));
    const currentLinkIds = new Set(currentData.links.map(l => l.id));
    const currentVisibleNodeIds = new Set(currentData.nodes.map(n => n.id));


    const animationDuration = 0.8; // Duration for GSAP animations

    // --- Update Nodes ---
    // 1. Update existing nodes & Add new ones
    currentData.nodes.forEach(node => {
        const targetScale = sizeScale(node.value);
        const targetColor = new THREE.Color(colorScale(node.category));

        if (nodeMeshes[node.id]) {
            // Node exists, animate its properties
            const mesh = nodeMeshes[node.id];
            gsap.to(mesh.position, {
                x: node.x, y: node.y, z: node.z,
                duration: animationDuration, ease: "power2.inOut"
            });
            gsap.to(mesh.scale, {
                x: targetScale, y: targetScale, z: targetScale,
                duration: animationDuration, ease: "elastic.out(1, 0.5)" // Bouncy effect
            });
            gsap.to(mesh.material.color, {
                r: targetColor.r, g: targetColor.g, b: targetColor.b,
                duration: animationDuration, ease: "sine.inOut"
            });
            // Ensure visible if it was hidden
            if (!mesh.visible) mesh.visible = true;
            gsap.to(mesh.material, { opacity: 1.0, duration: 0.3 });


        } else {
            // Node is new in this timestep, create it
            const nodeGeometry = new THREE.SphereGeometry(1, 16, 16);
            const nodeMaterial = new THREE.MeshStandardMaterial({
                color: targetColor,
                metalness: 0.3,
                roughness: 0.6,
                transparent: true, // Make transparent for fade-in
                opacity: 0 // Start invisible
            });
            const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
            mesh.position.set(node.x, node.y, node.z);
            mesh.scale.set(0.01, 0.01, 0.01); // Start small
            mesh.userData = { id: node.id };

            nodesGroup.add(mesh);
            nodeMeshes[node.id] = mesh;

            // Animate scale and opacity
            gsap.to(mesh.scale, {
                x: targetScale, y: targetScale, z: targetScale,
                duration: animationDuration, delay: 0.1, ease: "elastic.out(1, 0.5)"
            });
            gsap.to(mesh.material, {
                opacity: 1.0,
                duration: animationDuration * 0.5, delay: 0.1
            });
        }
    });

    // 2. Hide nodes that are no longer in the current data
    Object.keys(nodeMeshes).forEach(nodeId => {
        if (!currentVisibleNodeIds.has(nodeId)) {
            const mesh = nodeMeshes[nodeId];
            // Animate out and then hide
            gsap.to(mesh.scale, {
                x: 0.01, y: 0.01, z: 0.01,
                duration: animationDuration * 0.5, ease: "power2.in"
            });
            gsap.to(mesh.material, {
                opacity: 0,
                duration: animationDuration * 0.5,
                onComplete: () => { mesh.visible = false; } // Hide after animation
            });
        }
    });


    // --- Update Links ---
    const existingLinkIds = new Set(Object.keys(linkMeshes));

    // 1. Update existing links or create new ones
    currentData.links.forEach(link => {
        createOrUpdateLink(link, currentData.nodes); // This handles updates and creation
    });

    // 2. Hide links that are no longer present
    existingLinkIds.forEach(linkId => {
        if (!currentLinkIds.has(linkId) && linkMeshes[linkId]) {
            const line = linkMeshes[linkId];
            gsap.to(line.material, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    // Optional: Set visible false if needed, but opacity 0 usually suffices
                    // line.visible = false;
                }
            });
        }
    });


    // Update UI Label
    document.getElementById('timeLabel').textContent = timeStepIndex;
}

// --- UI Setup ---
function setupUI() {
    const slider = document.getElementById('timeSlider');
    const label = document.getElementById('timeLabel');

    slider.max = NUM_TIME_STEPS - 1;
    slider.value = currentTimeStep;
    label.textContent = currentTimeStep;

    slider.addEventListener('input', (event) => {
        const newTimeStep = parseInt(event.target.value, 10);
        if (newTimeStep !== currentTimeStep) {
            updateVisualization(newTimeStep);
        }
    });
}

// --- Helper Functions ---
function clearGroups() {
    // Remove all meshes from groups
    while (nodesGroup.children.length > 0) {
        nodesGroup.remove(nodesGroup.children[0]);
    }
    while (linksGroup.children.length > 0) {
        linksGroup.remove(linksGroup.children[0]);
    }
    // Note: This doesn't dispose geometries/materials, which is fine for this example
    // but important for larger, dynamic scenes to prevent memory leaks.
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
    
    if (stats) stats.begin();
    
    const delta = clock.getDelta() * animationSpeedFactor;
    if (controls) controls.update(delta);
    
    if (controls && controls.autoRotate) {
        controls.autoRotateSpeed = 2.0 * animationSpeedFactor;
    }
    
    // Update stats display if elements exist
    const statsDiv = document.getElementById('stats');
    if (statsDiv && statsDiv.style.display !== 'none') {
        const nodeCountEl = document.getElementById('nodeCount');
        const linkCountEl = document.getElementById('linkCount');
        const fpsEl = document.getElementById('fps');
        
        if (nodeCountEl) nodeCountEl.textContent = nodesGroup.children.length;
        if (linkCountEl) linkCountEl.textContent = linksGroup.children.length;
        if (fpsEl && stats) fpsEl.textContent = Math.round(stats.getFPS());
    }
    
    // Update node labels if visible
    if (hoveredNode) {
        const screenPosition = hoveredNode.position.clone();
        screenPosition.project(camera);
        
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
        
        if (nodeLabels[hoveredNode.userData.id]) {
            nodeLabels[hoveredNode.userData.id].style.left = `${x + 10}px`;
            nodeLabels[hoveredNode.userData.id].style.top = `${y + 10}px`;
        }
    }
    
    renderer.render(scene, camera);
    if (stats) stats.end();
}

// --- Setup Advanced Features ---
function setupAdvancedFeatures() {
    // Create node label container if it doesn't exist
    if (!document.getElementById('node-labels')) {
        const labelContainer = document.createElement('div');
        labelContainer.id = 'node-labels';
        labelContainer.style.position = 'absolute';
        labelContainer.style.top = '0';
        labelContainer.style.left = '0';
        labelContainer.style.pointerEvents = 'none';
        labelContainer.style.zIndex = '1000';
        document.body.appendChild(labelContainer);
    }

    // Setup raycaster and mouse events
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onNodeClick);

    // Initialize clock if not already initialized
    if (!clock.running) {
        clock.start();
    }

    // Setup performance monitoring
    if (!stats) {
        stats = new Stats();
        stats.showPanel(0);
        document.body.appendChild(stats.dom);
        stats.dom.style.display = 'none';
    }

    // Update UI elements initial state
    document.getElementById('nodeCount').textContent = nodesGroup.children.length;
    document.getElementById('linkCount').textContent = linksGroup.children.length;
    document.getElementById('fps').textContent = '60';

    console.log('Advanced features initialized');
}

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(nodesGroup.children);

    if (intersects.length > 0) {
        const intersectedNode = intersects[0].object;
        if (hoveredNode !== intersectedNode) {
            // Reset previous hover state
            if (hoveredNode) {
                resetNodeHighlight(hoveredNode);
            }
            // Set new hover state
            hoveredNode = intersectedNode;
            highlightNode(hoveredNode);
            showNodeLabel(hoveredNode, event.clientX, event.clientY);
        }
    } else if (hoveredNode) {
        resetNodeHighlight(hoveredNode);
        hideNodeLabel();
        hoveredNode = null;
    }
}

function highlightNode(node) {
    // Highlight the node
    gsap.to(node.scale, {
        x: node.scale.x * 1.3,
        y: node.scale.y * 1.3,
        z: node.scale.z * 1.3,
        duration: 0.3
    });
    
    // Highlight connected links
    Object.values(linkMeshes).forEach(link => {
        if (link.userData.sourceId === node.userData.id || 
            link.userData.targetId === node.userData.id) {
            gsap.to(link.material, {
                opacity: 1,
                linewidth: 2,
                duration: 0.3
            });
            link.material.color.set(0x00ff00);
        }
    });
}

function resetNodeHighlight(node) {
    // Reset node size
    gsap.to(node.scale, {
        x: sizeScale(node.userData.value),
        y: sizeScale(node.userData.value),
        z: sizeScale(node.userData.value),
        duration: 0.3
    });

    // Reset connected links
    Object.values(linkMeshes).forEach(link => {
        if (link.userData.sourceId === node.userData.id || 
            link.userData.targetId === node.userData.id) {
            gsap.to(link.material, {
                opacity: 0.5,
                linewidth: 1,
                duration: 0.3
            });
            link.material.color.set(0xaaaaaa);
        }
    });
}

function showNodeLabel(node, x, y) {
    if (!nodeLabels[node.userData.id]) {
        const label = document.createElement('div');
        label.className = 'node-label';
        label.style.position = 'absolute';
        label.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        label.style.color = '#fff';
        label.style.padding = '8px';
        label.style.borderRadius = '4px';
        label.style.fontSize = '12px';
        label.style.pointerEvents = 'none';
        document.getElementById('node-labels').appendChild(label);
        nodeLabels[node.userData.id] = label;
    }

    const label = nodeLabels[node.userData.id];
    label.style.display = 'block';
    label.style.left = `${x + 10}px`;
    label.style.top = `${y + 10}px`;
    
    // Get node data from current timestep
    const nodeData = simulationData[currentTimeStep].nodes.find(n => n.id === node.userData.id);
    const connections = countConnections(node.userData.id);
    
    label.innerHTML = `
        <div class="font-bold">${node.userData.id}</div>
        <div>Category: ${nodeData.category}</div>
        <div>Value: ${nodeData.value.toFixed(2)}</div>
        <div>Connections: ${connections}</div>
    `;
}

function hideNodeLabel() {
    Object.values(nodeLabels).forEach(label => {
        label.style.display = 'none';
    });
}

function countConnections(nodeId) {
    return simulationData[currentTimeStep].links.filter(
        link => link.source === nodeId || link.target === nodeId
    ).length;
}

function onNodeClick(event) {
    if (hoveredNode) {
        // Animate camera to focus on clicked node
        const nodePos = hoveredNode.position;
        const distance = 30; // Desired distance from node
        
        gsap.to(camera.position, {
            x: nodePos.x + distance,
            y: nodePos.y + distance / 2,
            z: nodePos.z + distance,
            duration: 1,
            ease: "power2.inOut",
            onUpdate: () => {
                camera.lookAt(nodePos);
            }
        });
    }
}

function setupAdvancedControls() {
    // Visualization Mode
    document.getElementById('vizMode').addEventListener('change', (e) => {
        visualizationMode = e.target.value;
        updateVisualizationMode();
    });

    // Node Size Scale
    document.getElementById('nodeSizeScale').addEventListener('input', (e) => {
        nodeSizeMultiplier = parseFloat(e.target.value);
        updateNodeSizes();
    });

    // Link Opacity
    document.getElementById('linkOpacity').addEventListener('input', (e) => {
        globalLinkOpacity = parseFloat(e.target.value);
        updateLinkOpacity();
    });

    // Animation Speed
    document.getElementById('animationSpeed').addEventListener('input', (e) => {
        animationSpeedFactor = parseFloat(e.target.value);
    });

    // Camera Reset
    document.getElementById('resetCamera').addEventListener('click', resetCamera);

    // Auto Rotate
    document.getElementById('toggleAutoRotate').addEventListener('click', () => {
        controls.autoRotate = !controls.autoRotate;
        document.getElementById('toggleAutoRotate').textContent = 
            controls.autoRotate ? 'Stop Rotation' : 'Auto Rotate';
    });

    // Stats Toggle
    document.getElementById('toggleStats').addEventListener('click', () => {
        stats.dom.style.display = stats.dom.style.display === 'none' ? 'block' : 'none';
        document.getElementById('stats').style.display = 
            document.getElementById('stats').style.display === 'none' ? 'block' : 'none';
    });
}

function updateVisualizationMode() {
    switch(visualizationMode) {
        case 'clusters':
            applyClustering();
            break;
        case 'categories':
            groupByCategories();
            break;
        default:
            resetPositions();
    }
}

function applyClustering() {
    const currentNodes = simulationData[currentTimeStep].nodes;
    const currentLinks = simulationData[currentTimeStep].links;
    
    // Simple k-means clustering
    const k = 3; // Number of clusters
    let centroids = [];
    
    // Initialize random centroids
    for(let i = 0; i < k; i++) {
        centroids.push({
            x: (Math.random() - 0.5) * SPREAD,
            y: (Math.random() - 0.5) * SPREAD,
            z: (Math.random() - 0.5) * SPREAD
        });
    }
    
    // Assign nodes to clusters and update centroids
    for(let iteration = 0; iteration < 5; iteration++) {
        // Assign nodes to nearest centroid
        currentNodes.forEach(node => {
            let minDist = Infinity;
            let clusterIndex = 0;
            
            centroids.forEach((centroid, i) => {
                const dist = Math.sqrt(
                    Math.pow(node.x - centroid.x, 2) +
                    Math.pow(node.y - centroid.y, 2) +
                    Math.pow(node.z - centroid.z, 2)
                );
                if(dist < minDist) {
                    minDist = dist;
                    clusterIndex = i;
                }
            });
            
            node.cluster = clusterIndex;
        });
        
        // Update centroids
        centroids = centroids.map((_, i) => {
            const clusterNodes = currentNodes.filter(n => n.cluster === i);
            if(clusterNodes.length === 0) return centroids[i];
            
            return {
                x: d3.mean(clusterNodes, n => n.x),
                y: d3.mean(clusterNodes, n => n.y),
                z: d3.mean(clusterNodes, n => n.z)
            };
        });
    }
    
    // Animate nodes to cluster positions
    currentNodes.forEach(node => {
        const centroid = centroids[node.cluster];
        const mesh = nodeMeshes[node.id];
        if(mesh) {
            const targetX = centroid.x + (Math.random() - 0.5) * 20;
            const targetY = centroid.y + (Math.random() - 0.5) * 20;
            const targetZ = centroid.z + (Math.random() - 0.5) * 20;
            
            gsap.to(mesh.position, {
                x: targetX,
                y: targetY,
                z: targetZ,
                duration: 1,
                ease: "power2.inOut"
            });
        }
    });
}

function groupByCategories() {
    const currentNodes = simulationData[currentTimeStep].nodes;
    const categories = [...new Set(currentNodes.map(n => n.category))];
    const angleStep = (2 * Math.PI) / categories.length;
    
    categories.forEach((category, i) => {
        const angle = angleStep * i;
        const radius = SPREAD * 0.7;
        const centerX = Math.cos(angle) * radius;
        const centerZ = Math.sin(angle) * radius;
        
        const categoryNodes = currentNodes.filter(n => n.category === category);
        categoryNodes.forEach(node => {
            const mesh = nodeMeshes[node.id];
            if(mesh) {
                const offset = 20;
                const targetX = centerX + (Math.random() - 0.5) * offset;
                const targetY = (Math.random() - 0.5) * offset;
                const targetZ = centerZ + (Math.random() - 0.5) * offset;
                
                gsap.to(mesh.position, {
                    x: targetX,
                    y: targetY,
                    z: targetZ,
                    duration: 1,
                    ease: "power2.inOut"
                });
            }
        });
    });
}

function resetPositions() {
    const currentNodes = simulationData[currentTimeStep].nodes;
    currentNodes.forEach(node => {
        const mesh = nodeMeshes[node.id];
        if(mesh) {
            gsap.to(mesh.position, {
                x: node.x,
                y: node.y,
                z: node.z,
                duration: 1,
                ease: "power2.inOut"
            });
        }
    });
}

function updateNodeSizes() {
    Object.values(nodeMeshes).forEach(mesh => {
        const scale = sizeScale(mesh.userData.value) * nodeSizeMultiplier;
        gsap.to(mesh.scale, {
            x: scale,
            y: scale,
            z: scale,
            duration: 0.3
        });
    });
}

function updateLinkOpacity() {
    Object.values(linkMeshes).forEach(link => {
        gsap.to(link.material, {
            opacity: globalLinkOpacity,
            duration: 0.3
        });
    });
}

function resetCamera() {
    gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: 150,
        duration: 1,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.lookAt(scene.position);
        }
    });
}

// --- Start Application ---
init();