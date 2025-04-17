import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Configuration ---
const config = {
    worldSize: 200,
    maxHerbivores: 100,
    maxFood: 300,
    foodSpawnRate: 0.05, // Chance per frame to spawn new food if below max

    herbivore: {
        baseEnergy: 100,
        energyDecayRate: 0.1, // Energy lost per second
        reproductionEnergyThreshold: 150,
        reproductionCost: 80,
        maxAge: 1000, // In simulation steps/frames (approx)
        baseSenseRadius: 30,
        baseMaxSpeed: 0.5,
        baseSize: 1,
        mutationRate: 0.1, // 10% chance for +/- variation
        foodEnergyValue: 50,
        eatDistance: 1.5,
        maxSteerForce: 0.01
    }
};

// --- Global Variables ---
let scene, camera, renderer, controls;
let clock = new THREE.Clock();
const herbivores = [];
const foods = [];
const worldBounds = new THREE.Box3(
    new THREE.Vector3(-config.worldSize / 2, 0, -config.worldSize / 2),
    new THREE.Vector3(config.worldSize / 2, 50, config.worldSize / 2)
);

// --- Constants ---
// Herbivore States (Makes code more readable and less prone to typos)
const STATE_WANDERING = 'wandering';
const STATE_SEEKING_FOOD = 'seeking_food';

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    scene.fog = new THREE.Fog(0x333333, config.worldSize * 0.7, config.worldSize * 1.2);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, config.worldSize * 2);
    camera.position.set(0, config.worldSize * 0.4, config.worldSize * 0.5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('simulationCanvas').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(50, 100, 75);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(config.worldSize, config.worldSize);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x55aa55, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 5, 0); // Look towards center slightly above ground

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.getElementById('addHerbivore').addEventListener('click', () => spawnHerbivore());
    document.getElementById('addFood').addEventListener('click', () => {
        for (let i = 0; i < 10; i++) spawnFood();
    });

    // Initial Population
    for (let i = 0; i < 10; i++) spawnHerbivore();
    for (let i = 0; i < 50; i++) spawnFood();

    // Start Animation Loop
    animate();
}

// --- Agent Classes ---

// Base class for simulation entities (optional, but good practice)
class Entity {
    constructor(position, geometry, material) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.castShadow = true;
        this.mesh.userData = this; // Link mesh back to the JS object
        scene.add(this.mesh);
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
    }

    getPosition() {
        return this.mesh.position;
    }

    removeFromScene() {
        scene.remove(this.mesh);
        // Optional: Dispose geometry/material if not reused
        // this.mesh.geometry.dispose();
        // this.mesh.material.dispose();
    }

    applyForce(force) {
        this.acceleration.add(force);
    }

    // Basic physics update
    updatePhysics(deltaTime) {
        this.velocity.add(this.acceleration.multiplyScalar(deltaTime));

        // Limit speed if applicable (Herbivores will override this)
        if (this.maxSpeed && this.velocity.lengthSq() > this.maxSpeed * this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.acceleration.set(0, 0, 0); // Reset acceleration each frame

        // Keep entity within bounds (simple wrap around)
        this.wrapToBounds();
    }

    wrapToBounds() {
        const pos = this.mesh.position;
        const halfSize = config.worldSize / 2;
        if (pos.x > halfSize) pos.x = -halfSize;
        if (pos.x < -halfSize) pos.x = halfSize;
        if (pos.z > halfSize) pos.z = -halfSize;
        if (pos.z < -halfSize) pos.z = halfSize;
        // Keep on ground level
        pos.y = this.mesh.geometry.parameters.height / 2 || 0.5; // Adjust y based on mesh height
    }
}

class Herbivore extends Entity {
    constructor(position, genes = null) {
        // --- Genetics ---
        if (!genes) {
            genes = {
                size: config.herbivore.baseSize * (1 + (Math.random() - 0.5) * 2 * config.herbivore.mutationRate),
                speed: config.herbivore.baseMaxSpeed * (1 + (Math.random() - 0.5) * 2 * config.herbivore.mutationRate),
                senseRadius: config.herbivore.baseSenseRadius * (1 + (Math.random() - 0.5) * 2 * config.herbivore.mutationRate)
            };
        }
        genes.size = Math.max(0.5, genes.size); // Min size
        genes.speed = Math.max(0.1, genes.speed); // Min speed
        genes.senseRadius = Math.max(5, genes.senseRadius); // Min sense radius

        const geometry = new THREE.ConeGeometry(genes.size * 0.5, genes.size * 1.5, 8);
        geometry.rotateX(Math.PI / 2); // Point cone forward
        const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
        super(position, geometry, material);

        this.genes = genes;
        this.maxSpeed = this.genes.speed;
        this.maxForce = config.herbivore.maxSteerForce;
        this.energy = config.herbivore.baseEnergy;
        this.age = 0;
        this.state = STATE_WANDERING; // Initial state
        this.targetFood = null;

        // Set initial Y position based on height
        this.mesh.position.y = genes.size * 1.5 / 2;
    }

    update(deltaTime, allFoods, allHerbivores) {
        this.energy -= config.herbivore.energyDecayRate * deltaTime;
        this.age++;

        // --- State Machine & Behavior ---
        this.updateState(allFoods);
        const steeringForce = this.calculateSteering(allFoods);
        this.applyForce(steeringForce);

        // --- Physics & Position Update ---
        this.updatePhysics(deltaTime); // Uses inherited Entity method, but with herbivore's maxSpeed

        // Point in direction of velocity
        if (this.velocity.lengthSq() > 0.001) {
            this.mesh.lookAt(this.mesh.position.clone().add(this.velocity));
        }


        // --- Interactions ---
        this.checkForFoodConsumption(allFoods);

        // --- Lifecycle ---
        if (this.energy <= 0 || this.age > config.herbivore.maxAge) {
            this.die();
            return 'dead'; // Signal to remove from simulation array
        }
        if (this.energy >= config.herbivore.reproductionEnergyThreshold) {
            this.reproduce(allHerbivores); // Pass herbivores for potential partner logic later
        }

        // Return 'alive' if the herbivore survived the update cycle
        return 'alive';
    }

    updatePhysics(deltaTime) {
        this.velocity.add(this.acceleration.multiplyScalar(deltaTime));

        // Limit speed
        if (this.velocity.lengthSq() > this.maxSpeed * this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.acceleration.set(0, 0, 0); // Reset acceleration

        // Keep entity within bounds
        this.wrapToBounds();
        // Ensure Y position is correct after potential wrap/movement
        this.mesh.position.y = this.genes.size * 1.5 / 2;
    }


    // Decides the herbivore's current behavior state based on energy levels and food availability.
    updateState(allFoods) {
        // If energy is low or already seeking food, try to find the nearest food source.
        if (this.energy < config.herbivore.baseEnergy * 0.8 || this.state === STATE_SEEKING_FOOD) {
            this.targetFood = this.findNearestFood(allFoods);
            if (this.targetFood) {
                this.state = STATE_SEEKING_FOOD; // Found food, switch to seeking.
            } else {
                this.state = STATE_WANDERING; // No food found nearby, resort to wandering.
            }
        } else {
            // If energy is high, just wander.
            this.state = STATE_WANDERING;
            this.targetFood = null; // Ensure no target is set while wandering.
        }

        // Check if the targeted food still exists (might have been eaten by another herbivore).
        // If the target is gone, revert to wandering to find a new target.
        if (this.state === STATE_SEEKING_FOOD && this.targetFood && !foods.includes(this.targetFood)) {
            this.state = STATE_WANDERING;
            this.targetFood = null;
        }

    }

    // Calculates the steering force based on the current state.
    calculateSteering(allFoods) {
        if (this.state === STATE_SEEKING_FOOD && this.targetFood) {
            // If seeking food, steer towards the target.
            return this.seek(this.targetFood.getPosition());
        } else {
            // Otherwise, wander aimlessly.
            return this.wander();
        }
        // Future behavior logic (like fleeing predators or flocking) could be added here.
    }

    // --- Steering Behaviors ---

    // Calculates a steering force to move towards a target position.
    seek(targetPosition) {
        // 1. Calculate the desired velocity vector (pointing from current pos to target).
        const desired = targetPosition.clone().sub(this.getPosition());
        // 2. Scale desired velocity to maximum speed.
        desired.normalize().multiplyScalar(this.maxSpeed);
        // 3. Calculate the steering force vector (difference between desired and current velocity).
        const steer = desired.sub(this.velocity);
        // 4. Limit the steering force to the maximum allowed force.
        steer.clampLength(0, this.maxForce);
        return steer;
    }

    // Calculates a steering force for wandering behavior.
    wander() {
        // Simple wander: Apply a small, random, constantly changing force.
        // This creates somewhat erratic but generally forward movement.
        let wanderForce = new THREE.Vector3(
            (Math.random() - 0.5) * 2, // Random X component
            0, // Keep the force in the XZ plane (no vertical wandering)
            (Math.random() - 0.5) * 2  // Random Z component
        );
        // Normalize and scale the force to be less than the maximum steering force.
        wanderForce.normalize().multiplyScalar(this.maxForce * 0.5);
        return wanderForce;
    }

    // Finds the nearest Food object within the herbivore's sense radius.
    findNearestFood(allFoods) {
        let nearestDistSq = this.genes.senseRadius * this.genes.senseRadius; // Max distance squared
        let nearestFood = null;
        // Iterate through all available food items.
        for (const food of allFoods) {
            const distSq = this.getPosition().distanceToSquared(food.getPosition());
            // If this food is closer than the current nearest, update nearest.
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestFood = food;
            }
        }
        return nearestFood; // Returns the closest food object or null if none are in range.
    }

    // Checks if the herbivore is close enough to its target food to eat it.
    checkForFoodConsumption(allFoods) {
        // Only check if currently seeking a specific food target.
        if (this.targetFood && this.state === STATE_SEEKING_FOOD) {
            const distSq = this.getPosition().distanceToSquared(this.targetFood.getPosition());
            // Check if distance is within the eat distance (considering herbivore size).
            if (distSq < (config.herbivore.eatDistance + this.genes.size * 0.5) ** 2) {
                this.eat(this.targetFood);
                this.targetFood = null; // Clear the target after eating.
                this.state = STATE_WANDERING; // Switch back to wandering temporarily.
            }
        }
    }

    // Consumes a food object, gaining energy and removing the food from the simulation.
    eat(food) {
        this.energy += config.herbivore.foodEnergyValue;
        food.getEaten(); // Notify the food object it has been consumed.
    }

    // Creates a new herbivore (offspring) if population limits allow.
    reproduce(allHerbivores) {
        // Check if the maximum herbivore population has been reached.
        if (herbivores.length >= config.maxHerbivores) return;

        // Deduct the energy cost of reproduction from the parent.
        this.energy -= config.herbivore.reproductionCost;

        // Create genes for the child, based on the parent's genes with slight random mutations.
        const childGenes = {
            size: this.genes.size * (1 + (Math.random() - 0.5) * 2 * config.herbivore.mutationRate),
            speed: this.genes.speed * (1 + (Math.random() - 0.5) * 2 * config.herbivore.mutationRate),
            senseRadius: this.genes.senseRadius * (1 + (Math.random() - 0.5) * 2 * config.herbivore.mutationRate)
        };

        // Calculate a spawn position slightly behind the parent.
        const offset = this.velocity.clone().normalize().multiplyScalar(-this.genes.size * 2);
        const spawnPos = this.getPosition().clone().add(offset);

        // Create the new herbivore instance and add it to the simulation.
        spawnHerbivore(spawnPos, childGenes);
    }


    // Handles the removal of the herbivore from the simulation.
    die() {
        // Find the index of this herbivore in the global array.
        const index = herbivores.indexOf(this);
        // Remove it from the array if found.
        if (index > -1) {
            herbivores.splice(index, 1);
        }
        // Remove the 3D mesh from the scene.
        this.removeFromScene();
        // Potential future enhancement: Drop a 'corpse' resource or trigger other effects.
    }
}

class Food extends Entity {
    constructor(position) {
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        super(position, geometry, material);
        this.mesh.position.y = 0.5; // Set y position for sphere radius
    }

    getEaten() {
        // Find index and remove from global array
        const index = foods.indexOf(this);
        if (index > -1) {
            foods.splice(index, 1);
        }
        this.removeFromScene();
    }

    // Override physics update - food doesn't move
    updatePhysics(deltaTime) {
        // No movement
        this.wrapToBounds(); // Ensure it stays in bounds if somehow moved
        this.mesh.position.y = 0.5;
    }
}

// --- Helper Functions ---
function getRandomPosition() {
    const halfSize = config.worldSize / 2;
    return new THREE.Vector3(
        (Math.random() - 0.5) * config.worldSize,
        1, // Start slightly above ground
        (Math.random() - 0.5) * config.worldSize
    );
}

function spawnHerbivore(position = getRandomPosition(), genes = null) {
    if (herbivores.length >= config.maxHerbivores) return;
    const herbivore = new Herbivore(position, genes);
    herbivores.push(herbivore);
}

function spawnFood(position = getRandomPosition()) {
    if (foods.length >= config.maxFood) return;
    // Ensure food doesn't spawn too high
    position.y = 0.5;
    const food = new Food(position);
    foods.push(food);
}

function updateStats() {
    document.getElementById('herbivoreCount').textContent = herbivores.length;
    document.getElementById('foodCount').textContent = foods.length;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Simulation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Update Herbivores
    // Iterate backwards to safely remove elements during loop
    for (let i = herbivores.length - 1; i >= 0; i--) {
        const status = herbivores[i].update(deltaTime, foods, herbivores);
        // Removal handled within herbivore.die() and reproduce() adds to array
    }

    // Spawn new food periodically
    if (foods.length < config.maxFood && Math.random() < config.foodSpawnRate) {
        spawnFood();
    }


    controls.update(); // Update orbit controls
    renderer.render(scene, camera);
    updateStats(); // Update UI counts
}

// --- Start ---
init();