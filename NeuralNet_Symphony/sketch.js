// Ensure GSAP doesn't conflict with p5.js's 'register' or other potential properties
gsap.config({ nullTargetWarn: false });

const sketch = (p) => {
    let nodes = [];
    let connections = [];
    const numLayers = 5;
    const nodesPerLayer = [5, 7, 8, 7, 4]; // Example: Input, Hidden1, Hidden2, Hidden3, Output
    const layerSpacing = 150;
    const nodeRadius = 10;
    const baseNodeColor = p.color(0, 100, 150, 180); // Tealish blue
    const pulseColor = p.color(100, 255, 255, 255); // Bright Cyan
    const connectionColor = p.color(0, 150, 200, 50); // Lighter teal, semi-transparent

    let osc; // Oscillator for sound

    // --- Node Class ---
    class Node {
        constructor(x, y, layerIndex, nodeIndex) {
            this.x = x;
            this.y = y;
            this.layerIndex = layerIndex;
            this.nodeIndex = nodeIndex; // Index within its layer
            this.radius = nodeRadius;
            this.baseRadius = nodeRadius;
            this.color = baseNodeColor;
            this.baseColor = baseNodeColor;
            this.pulseIntensity = 0; // 0 to 1, controls pulse effect
            this.connections = []; // Nodes this one connects TO
            this.soundFrequency = 220 + (layerIndex * 110) + (nodeIndex * 20); // Vary freq
        }

        addConnection(targetNode) {
            this.connections.push(targetNode);
        }

        // Trigger the pulse animation and sound
        activate(delay = 0) {
            // Prevent re-triggering if already pulsing strongly
            if (this.pulseIntensity > 0.3) return;

            // Sound (start muted, will unmute on first user click)
            if (osc && p.getAudioContext().state === 'running') {
                osc.freq(this.soundFrequency, 0.05);
                osc.amp(0.3, 0.05); // Quick attack
                setTimeout(() => {
                    osc.amp(0, 0.2); // Slightly longer decay
                }, 100); // Start decay after 100ms
            }


            // GSAP Animation for visual pulse
            gsap.to(this, {
                pulseIntensity: 1,
                duration: 0.2,
                delay: delay,
                ease: "power2.out",
                onComplete: () => {
                    // Propagate pulse to next layer
                    this.connections.forEach(nextNode => {
                        nextNode.activate(0.1); // Add slight delay for propagation
                    });
                    // Decay animation
                    gsap.to(this, {
                        pulseIntensity: 0,
                        duration: 0.8,
                        ease: "power1.inOut",
                    });
                }
            });
        }

        // Check if a point (like mouse) is inside the node
        isClicked(px, py) {
            let d = p.dist(px, py, this.x, this.y);
            return d < this.radius * 1.5; // Make clickable area slightly larger
        }

        draw() {
            // Interpolate color and radius based on pulseIntensity
            let currentColor = p.lerpColor(this.baseColor, pulseColor, this.pulseIntensity);
            let currentRadius = p.lerp(this.baseRadius, this.baseRadius * 2.0, this.pulseIntensity);

            p.noStroke();
            p.fill(currentColor);
            p.ellipse(this.x, this.y, currentRadius * 2, currentRadius * 2);

            // Add a subtle outer glow when pulsing
            if (this.pulseIntensity > 0.1) {
                p.fill(pulseColor.levels[0], pulseColor.levels[1], pulseColor.levels[2], this.pulseIntensity * 60); // Fainter glow
                p.ellipse(this.x, this.y, currentRadius * 2 + 10 * this.pulseIntensity, currentRadius * 2 + 10 * this.pulseIntensity);
            }
        }
    }

    // --- Setup ---
    p.setup = () => {
        const container = document.getElementById('canvas-container');
        const canvasWidth = Math.min(800, p.windowWidth - 50); // Responsive width
        const canvasHeight = 500;
        let cnv = p.createCanvas(canvasWidth, canvasHeight);
        cnv.parent(container); // Attach canvas to the container div

        // --- Initialize Sound ---
        // Create an oscillator (sine wave)
        osc = new p5.Oscillator('sine');
        osc.amp(0); // Start silent
        osc.start();
        // !!! Crucial for audio: Audio context needs to be started by user interaction
        // We'll try to resume it in mousePressed

        // --- Create Nodes ---
        let totalNodesPrevLayer = 0;
        for (let i = 0; i < numLayers; i++) {
            let layerNodes = [];
            let numNodesInLayer = nodesPerLayer[i];
            // Calculate vertical spacing to center nodes in the layer
            let totalHeight = (numNodesInLayer - 1) * (canvasHeight / (nodesPerLayer[i] + 1));
            let startY = (canvasHeight - totalHeight) / 2;

            for (let j = 0; j < numNodesInLayer; j++) {
                let x = p.map(i, 0, numLayers - 1, canvasWidth * 0.1, canvasWidth * 0.9);
                // let y = p.map(j, 0, numNodesInLayer - 1, canvasHeight * 0.2, canvasHeight * 0.8);
                let ySpacing = canvasHeight / (nodesPerLayer[i] + 1);
                let y = startY + j * ySpacing;

                if (numNodesInLayer === 1) y = canvasHeight / 2; // Center if only one node

                let node = new Node(x, y, i, j);
                layerNodes.push(node);
                nodes.push(node);
            }
        }

        // --- Create Connections (Simple: connect all nodes to all nodes in next layer) ---
        for (let i = 0; i < numLayers - 1; i++) {
            let currentLayerNodes = nodes.filter(n => n.layerIndex === i);
            let nextLayerNodes = nodes.filter(n => n.layerIndex === i + 1);

            currentLayerNodes.forEach(currentNode => {
                nextLayerNodes.forEach(nextNode => {
                    currentNode.addConnection(nextNode);
                    connections.push({ from: currentNode, to: nextNode });
                });
            });
        }

        console.log(`Created ${nodes.length} nodes and ${connections.length} connections.`);
    };

    // --- Draw Loop ---
    p.draw = () => {
        p.background(17, 24, 39); // Tailwind gray-900 equivalent

        // 1. Draw Connections
        p.strokeWeight(1);
        p.stroke(connectionColor);
        connections.forEach(conn => {
            // Optional: Make connection brighter if 'from' node is pulsing
            let pulseEffect = conn.from.pulseIntensity;
            let alpha = p.map(pulseEffect, 0, 1, 50, 150); // Base alpha 50, max 150
            let weight = p.map(pulseEffect, 0, 1, 0.5, 1.5); // Base weight 0.5, max 1.5
            p.stroke(connectionColor.levels[0], connectionColor.levels[1], connectionColor.levels[2], alpha);
            p.strokeWeight(weight);

            p.line(conn.from.x, conn.from.y, conn.to.x, conn.to.y);
        });

        // 2. Draw Nodes (draw on top of connections)
        nodes.forEach(node => {
            node.draw();
        });
    };

    // --- Interaction ---
    p.mousePressed = () => {
        // IMPORTANT: Resume audio context on first click/tap
        if (p.getAudioContext().state !== 'running') {
            p.getAudioContext().resume().then(() => {
                console.log("Audio Context is now running!");
                // Maybe play a very short, quiet sound to confirm
                osc.amp(0.01, 0.01); // Very quiet blip
                setTimeout(() => { osc.amp(0, 0.01); }, 20);
            });
        }


        // Check if an input node (layer 0) was clicked
        nodes.forEach(node => {
            if (node.layerIndex === 0 && node.isClicked(p.mouseX, p.mouseY)) {
                console.log(`Activating node (${node.layerIndex}, ${node.nodeIndex})`);
                node.activate();
            }
        });
    };

    // --- Window Resize Handling ---
    p.windowResized = () => {
        const container = document.getElementById('canvas-container');
        const canvasWidth = Math.min(800, p.windowWidth - 50);
        const canvasHeight = 500; // Keep height fixed or make it responsive too
        p.resizeCanvas(canvasWidth, canvasHeight);

        // Recalculate node positions (simple recalculation)
        for (let i = 0; i < numLayers; i++) {
            let layerNodes = nodes.filter(n => n.layerIndex === i);
            let numNodesInLayer = layerNodes.length; // Use actual count

            let totalHeight = (numNodesInLayer - 1) * (canvasHeight / (nodesPerLayer[i] + 1)); // Use original count for spacing consistency
            let startY = (canvasHeight - totalHeight) / 2;

            layerNodes.forEach((node, j) => { // Use index within the *filtered* layerNodes
                node.x = p.map(i, 0, numLayers - 1, canvasWidth * 0.1, canvasWidth * 0.9);
                let ySpacing = canvasHeight / (nodesPerLayer[i] + 1); // Still use original count for spacing
                node.y = startY + j * ySpacing; // Use actual index j here
                if (numNodesInLayer === 1) node.y = canvasHeight / 2;
            });
        }
    };// Ensure GSAP doesn't conflict with p5.js's 'register' or other potential properties
    gsap.config({ nullTargetWarn: false });

    const sketch = (p) => {
        let nodes = [];
        let connections = [];
        const numLayers = 5;
        const nodesPerLayer = [5, 7, 8, 7, 4]; // Example: Input, Hidden1, Hidden2, Hidden3, Output
        const layerSpacing = 150;
        const nodeRadius = 10;
        const baseNodeColor = p.color(0, 100, 150, 180); // Tealish blue
        const pulseColor = p.color(100, 255, 255, 255); // Bright Cyan
        const connectionColor = p.color(0, 150, 200, 50); // Lighter teal, semi-transparent

        let osc; // Oscillator for sound

        // --- Node Class ---
        class Node {
            constructor(x, y, layerIndex, nodeIndex) {
                this.x = x;
                this.y = y;
                this.layerIndex = layerIndex;
                this.nodeIndex = nodeIndex; // Index within its layer
                this.radius = nodeRadius;
                this.baseRadius = nodeRadius;
                this.color = baseNodeColor;
                this.baseColor = baseNodeColor;
                this.pulseIntensity = 0; // 0 to 1, controls pulse effect
                this.connections = []; // Nodes this one connects TO
                this.soundFrequency = 220 + (layerIndex * 110) + (nodeIndex * 20); // Vary freq
            }

            addConnection(targetNode) {
                this.connections.push(targetNode);
            }

            // Trigger the pulse animation and sound
            activate(delay = 0) {
                // Prevent re-triggering if already pulsing strongly
                if (this.pulseIntensity > 0.3) return;

                // Sound (start muted, will unmute on first user click)
                if (osc && p.getAudioContext().state === 'running') {
                    osc.freq(this.soundFrequency, 0.05);
                    osc.amp(0.3, 0.05); // Quick attack
                    p.C(() => {
                        osc.amp(0, 0.2); // Slightly longer decay
                    }, 0.1); // Start decay after 100ms
                }


                // GSAP Animation for visual pulse
                gsap.to(this, {
                    pulseIntensity: 1,
                    duration: 0.2,
                    delay: delay,
                    ease: "power2.out",
                    onComplete: () => {
                        // Propagate pulse to next layer
                        this.connections.forEach(nextNode => {
                            nextNode.activate(0.1); // Add slight delay for propagation
                        });
                        // Decay animation
                        gsap.to(this, {
                            pulseIntensity: 0,
                            duration: 0.8,
                            ease: "power1.inOut",
                        });
                    }
                });
            }

            // Check if a point (like mouse) is inside the node
            isClicked(px, py) {
                let d = p.dist(px, py, this.x, this.y);
                return d < this.radius * 1.5; // Make clickable area slightly larger
            }

            draw() {
                // Interpolate color and radius based on pulseIntensity
                let currentColor = p.lerpColor(this.baseColor, pulseColor, this.pulseIntensity);
                let currentRadius = p.lerp(this.baseRadius, this.baseRadius * 2.0, this.pulseIntensity);

                p.noStroke();
                p.fill(currentColor);
                p.ellipse(this.x, this.y, currentRadius * 2, currentRadius * 2);

                // Add a subtle outer glow when pulsing
                if (this.pulseIntensity > 0.1) {
                    p.fill(pulseColor.levels[0], pulseColor.levels[1], pulseColor.levels[2], this.pulseIntensity * 60); // Fainter glow
                    p.ellipse(this.x, this.y, currentRadius * 2 + 10 * this.pulseIntensity, currentRadius * 2 + 10 * this.pulseIntensity);
                }
            }
        }

        // --- Setup ---
        p.setup = () => {
            const container = document.getElementById('canvas-container');
            const canvasWidth = Math.min(800, p.windowWidth - 50); // Responsive width
            const canvasHeight = 500;
            let cnv = p.createCanvas(canvasWidth, canvasHeight);
            cnv.parent(container); // Attach canvas to the container div

            // --- Initialize Sound ---
            // Create an oscillator (sine wave)
            osc = new p5.Oscillator('sine');
            osc.amp(0); // Start silent
            osc.start();
            // !!! Crucial for audio: Audio context needs to be started by user interaction
            // We'll try to resume it in mousePressed

            // --- Create Nodes ---
            let totalNodesPrevLayer = 0;
            for (let i = 0; i < numLayers; i++) {
                let layerNodes = [];
                let numNodesInLayer = nodesPerLayer[i];
                // Calculate vertical spacing to center nodes in the layer
                let totalHeight = (numNodesInLayer - 1) * (canvasHeight / (nodesPerLayer[i] + 1));
                let startY = (canvasHeight - totalHeight) / 2;

                for (let j = 0; j < numNodesInLayer; j++) {
                    let x = p.map(i, 0, numLayers - 1, canvasWidth * 0.1, canvasWidth * 0.9);
                    // let y = p.map(j, 0, numNodesInLayer - 1, canvasHeight * 0.2, canvasHeight * 0.8);
                    let ySpacing = canvasHeight / (nodesPerLayer[i] + 1);
                    let y = startY + j * ySpacing;

                    if (numNodesInLayer === 1) y = canvasHeight / 2; // Center if only one node

                    let node = new Node(x, y, i, j);
                    layerNodes.push(node);
                    nodes.push(node);
                }
            }

            // --- Create Connections (Simple: connect all nodes to all nodes in next layer) ---
            for (let i = 0; i < numLayers - 1; i++) {
                let currentLayerNodes = nodes.filter(n => n.layerIndex === i);
                let nextLayerNodes = nodes.filter(n => n.layerIndex === i + 1);

                currentLayerNodes.forEach(currentNode => {
                    nextLayerNodes.forEach(nextNode => {
                        currentNode.addConnection(nextNode);
                        connections.push({ from: currentNode, to: nextNode });
                    });
                });
            }

            console.log(`Created ${nodes.length} nodes and ${connections.length} connections.`);
        };

        // --- Draw Loop ---
        p.draw = () => {
            p.background(17, 24, 39); // Tailwind gray-900 equivalent

            // 1. Draw Connections
            p.strokeWeight(1);
            p.stroke(connectionColor);
            connections.forEach(conn => {
                // Optional: Make connection brighter if 'from' node is pulsing
                let pulseEffect = conn.from.pulseIntensity;
                let alpha = p.map(pulseEffect, 0, 1, 50, 150); // Base alpha 50, max 150
                let weight = p.map(pulseEffect, 0, 1, 0.5, 1.5); // Base weight 0.5, max 1.5
                p.stroke(connectionColor.levels[0], connectionColor.levels[1], connectionColor.levels[2], alpha);
                p.strokeWeight(weight);

                p.line(conn.from.x, conn.from.y, conn.to.x, conn.to.y);
            });

            // 2. Draw Nodes (draw on top of connections)
            nodes.forEach(node => {
                node.draw();
            });
        };

        // --- Interaction ---
        p.mousePressed = () => {
            // IMPORTANT: Resume audio context on first click/tap
            if (p.getAudioContext().state !== 'running') {
                p.getAudioContext().resume().then(() => {
                    console.log("Audio Context is now running!");
                    // Maybe play a very short, quiet sound to confirm
                    osc.amp(0.01, 0.01); // Very quiet blip
                    p.C(() => { osc.amp(0, 0.01); }, 0.02);
                });
            }


            // Check if an input node (layer 0) was clicked
            nodes.forEach(node => {
                if (node.layerIndex === 0 && node.isClicked(p.mouseX, p.mouseY)) {
                    console.log(`Activating node (${node.layerIndex}, ${node.nodeIndex})`);
                    node.activate();
                }
            });
        };

        // --- Window Resize Handling ---
        p.windowResized = () => {
            const container = document.getElementById('canvas-container');
            const canvasWidth = Math.min(800, p.windowWidth - 50);
            const canvasHeight = 500; // Keep height fixed or make it responsive too
            p.resizeCanvas(canvasWidth, canvasHeight);

            // Recalculate node positions (simple recalculation)
            for (let i = 0; i < numLayers; i++) {
                let layerNodes = nodes.filter(n => n.layerIndex === i);
                let numNodesInLayer = layerNodes.length; // Use actual count

                let totalHeight = (numNodesInLayer - 1) * (canvasHeight / (nodesPerLayer[i] + 1)); // Use original count for spacing consistency
                let startY = (canvasHeight - totalHeight) / 2;

                layerNodes.forEach((node, j) => { // Use index within the *filtered* layerNodes
                    node.x = p.map(i, 0, numLayers - 1, canvasWidth * 0.1, canvasWidth * 0.9);
                    let ySpacing = canvasHeight / (nodesPerLayer[i] + 1); // Still use original count for spacing
                    node.y = startY + j * ySpacing; // Use actual index j here
                    if (numNodesInLayer === 1) node.y = canvasHeight / 2;
                });
            }
        };

    };
}
    // Instantiate p5.js in instance mode, attached to the container div
    new p5(sketch, 'canvas-container');