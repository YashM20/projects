// --- DOM Elements ---
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true }); // willReadFrequently for getImageData performance
const canvasContainer = document.getElementById('canvasContainer');
const gridOverlay = document.getElementById('gridOverlay');
const colorPicker = document.getElementById('colorPicker');
const paletteContainer = document.getElementById('palette');
const pencilToolBtn = document.getElementById('pencilTool');
const eraserToolBtn = document.getElementById('eraserTool');
const fillToolBtn = document.getElementById('fillTool');
const pickerToolBtn = document.getElementById('pickerTool');
const pixelSizeSlider = document.getElementById('pixelSizeSlider');
const pixelSizeLabel = document.getElementById('pixelSizeLabel');
const gridToggle = document.getElementById('gridToggle');
const imageUpload = document.getElementById('imageUpload');
const imagePixelSizeSlider = document.getElementById('imagePixelSizeSlider');
const imagePixelSizeLabel = document.getElementById('imagePixelSizeLabel');
const convertImageBtn = document.getElementById('convertImageBtn');
const clearCanvasBtn = document.getElementById('clearCanvasBtn');
const exportBtn = document.getElementById('exportBtn');
const canvasSizeSelect = document.getElementById('canvasSizeSelect');
const messageModal = document.getElementById('messageModal');
const modalMessageText = document.getElementById('modalMessageText');
const undoBtn = document.getElementById('undoBtn'); // Added Undo Button
const redoBtn = document.getElementById('redoBtn'); // Added Redo Button

// --- State Variables ---
let isDrawing = false;
let currentTool = 'pencil'; // 'pencil', 'eraser', 'fill', 'picker'
let currentColor = colorPicker.value;
let brushSize = parseInt(pixelSizeSlider.value, 10); // Size of the brush in grid cells
let canvasLogicalWidth = parseInt(canvasSizeSelect.value, 10); // Width in pixels (cells)
let canvasLogicalHeight = parseInt(canvasSizeSelect.value, 10); // Height in pixels (cells)
let pixelSize = canvas.width / canvasLogicalWidth; // Size of one 'pixel' on the canvas
let showGrid = gridToggle.checked;
let uploadedImage = null; // Store the uploaded image File object or Image element
let lastDrawCoords = { x: -1, y: -1 }; // Optimization for drawing lines

// --- History State ---
let historyStack = [];
let redoStack = [];
const MAX_HISTORY_SIZE = 50; // Limit history to prevent memory issues
let currentHistoryState = null; // Store the initial state

// Use canvas background color (assumed white) for eraser
const ERASER_COLOR = '#FFFFFF';

// --- Default Palette ---
const defaultPalette = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#808080', '#c0c0c0', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080'
];

// --- Initialization ---
function initialize() {
    console.log("Initializing Pixel Art Generator...");
    setupCanvas();
    createPalette();
    addEventListeners();
    updateGrid();
    setActiveTool(pencilToolBtn); // Start with pencil
    saveInitialState(); // Save the blank canvas state initially
    updateUndoRedoButtons(); // Update button state
    console.log("Initialization complete.");
}

// --- Canvas Setup ---
function setupCanvas() {
    // Calculate physical pixel size based on logical size
    pixelSize = canvas.width / canvasLogicalWidth;
    console.log(`Canvas setup: Logical=${canvasLogicalWidth}x${canvasLogicalHeight}, Physical=${canvas.width}x${canvas.height}, PixelSize=${pixelSize}`);
    clearCanvas(); // Clear with initial background color (now white by default)
    // History is cleared and initial state saved in clearCanvas
}

function resizeCanvas() {
    const newSize = parseInt(canvasSizeSelect.value, 10);
    if (newSize !== canvasLogicalWidth) {
         // Optional: Ask for confirmation if canvas has content
         // if (!confirm("Resizing will clear the canvas. Continue?")) {
         //    canvasSizeSelect.value = canvasLogicalWidth.toString(); // Revert selection
         //    return;
         // }
        canvasLogicalWidth = newSize;
        canvasLogicalHeight = newSize;
        // Keep physical canvas size fixed for now, adjust pixelSize
        pixelSize = canvas.width / canvasLogicalWidth;
        console.log(`Canvas resized: Logical=${canvasLogicalWidth}x${canvasLogicalHeight}, PixelSize=${pixelSize}`);
         // Clear canvas (defaults to white)
        clearCanvas(); // This will also reset history
        updateGrid();
    }
}

// --- Palette ---
function createPalette() {
    paletteContainer.innerHTML = ''; // Clear existing palette
    defaultPalette.forEach(color => {
        const colorDiv = document.createElement('div');
        colorDiv.style.backgroundColor = color;
        colorDiv.classList.add('w-6', 'h-6', 'rounded', 'cursor-pointer', 'border', 'border-gray-300');
        colorDiv.addEventListener('click', () => {
            currentColor = color;
            colorPicker.value = color; // Sync the main color picker
            console.log("Palette color selected:", currentColor);
        });
        paletteContainer.appendChild(colorDiv);
    });
}

// --- Grid ---
function updateGrid() {
    if (showGrid && pixelSize > 2) { // Only show grid if pixels are reasonably large
        gridOverlay.style.display = 'block';
        // Use CSS variables for dynamic background size
        gridOverlay.style.setProperty('--pixel-size', `${pixelSize}px`);
        gridOverlay.classList.add('grid-pattern'); // Class defined in <style type="text/tailwindcss">
        console.log("Grid enabled, pixel size:", pixelSize);
    } else {
        gridOverlay.style.display = 'none';
        gridOverlay.classList.remove('grid-pattern');
        console.log("Grid disabled");
    }
}

// --- Drawing Logic ---
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    // Adjust for canvas scaling if its CSS size differs from its attribute size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Calculate coordinates relative to the canvas element
    let clientX, clientY;
    if (evt.touches && evt.touches.length > 0) {
        // Handle touch events
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    } else {
        // Handle mouse events
        clientX = evt.clientX;
        clientY = evt.clientY;
    }

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    // Convert canvas coordinates to grid coordinates
    const gridX = Math.floor(canvasX / pixelSize);
    const gridY = Math.floor(canvasY / pixelSize);

    return { x: gridX, y: gridY };
}

function drawPixel(gridX, gridY, color) {
    // Clamp coordinates to be within the canvas bounds
    gridX = Math.max(0, Math.min(gridX, canvasLogicalWidth - 1));
    gridY = Math.max(0, Math.min(gridY, canvasLogicalHeight - 1));

    // Adjust fillRect call to account for potential brush size > 1
    const startX = gridX * pixelSize;
    const startY = gridY * pixelSize;
    const size = pixelSize * brushSize; // Use brushSize

    ctx.fillStyle = color;
    // Ensure the drawn rectangle doesn't exceed canvas bounds due to brush size
    ctx.fillRect(startX, startY,
                 Math.min(size, canvas.width - startX),
                 Math.min(size, canvas.height - startY));
}

// Bresenham's line algorithm adapted for grid drawing
function drawLine(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
        drawPixel(x0, y0, color); // Use drawPixel to handle brush size
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
}


function fillArea(startX, startY, fillColor) {
    // --- Save state before operation --- 
    // No need here, saveState called in handleDrawStart for fill

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
     // Target coordinate is a grid cell, find a representative pixel *within* that cell
    const targetPixelX = Math.floor((startX + 0.5) * pixelSize);
    const targetPixelY = Math.floor((startY + 0.5) * pixelSize);

    const targetColor = getPixelColor(targetPixelX, targetPixelY, data, canvas.width);

    // Convert fillColor hex to RGBA array
    const fillRgba = hexToRgba(fillColor);
    if (!fillRgba) return; // Invalid hex

    // Convert targetColor array to comparable string/object if needed, or compare components
     if (!targetColor || colorsMatch(targetColor, fillRgba)) {
        console.log("Fill target color is invalid or the same as fill color. Aborting.");
        return; // Avoid infinite loop if start color is same as fill color or invalid
    }

    const stack = [[startX, startY]]; // Stack for flood fill algorithm
    const visited = new Set(); // Keep track of visited grid cells

    function getPixelColor(px, py, data, width) {
        // Ensure pixel coordinates are within canvas physical bounds
        px = Math.max(0, Math.min(Math.floor(px), canvas.width - 1));
        py = Math.max(0, Math.min(Math.floor(py), canvas.height - 1));
        const index = (py * width + px) * 4;
        // Check if data is valid at this index
         if (index < 0 || index + 3 >= data.length) {
            console.warn(`Invalid pixel coordinates for getPixelColor: (${px}, ${py})`);
            return null; // Indicate invalid color
        }
        return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    }

    function colorsMatch(color1, color2) {
        // Simple RGBA component comparison
        // Handle null case for color1
         if (!color1 || !color2) return false;
        return color1[0] === color2[0] &&
               color1[1] === color2[1] &&
               color1[2] === color2[2] &&
               color1[3] === color2[3];
    }

    function hexToRgba(hex) {
        if (!hex) return null;
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        if (hex.length !== 6) return null; // Basic validation
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return [r, g, b, 255]; // Assuming full opacity for fill
    }

    console.log(`Starting fill at (${startX}, ${startY}) with color ${fillColor}. Target color: [${targetColor}]`);

    ctx.fillStyle = fillColor; // Set fill style once

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const cellKey = `${x},${y}`;

        // Check bounds and if already visited
        if (x < 0 || x >= canvasLogicalWidth || y < 0 || y >= canvasLogicalHeight || visited.has(cellKey)) {
            continue;
        }

        // Get the color of the current *grid cell* (sample near the center)
        const currentPixelX = Math.floor((x + 0.5) * pixelSize);
        const currentPixelY = Math.floor((y + 0.5) * pixelSize);
        const currentColor = getPixelColor(currentPixelX, currentPixelY, data, canvas.width);

        if (currentColor && colorsMatch(currentColor, targetColor)) {
            // Color matches the target, fill this grid cell and add neighbors to stack
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize); // Fill the grid cell
            visited.add(cellKey); // Mark as visited

            // Add neighbors (4-connectivity)
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
    }
     console.log("Fill operation completed.");
}

function pickColor(gridX, gridY) {
     // Clamp coordinates
    gridX = Math.max(0, Math.min(gridX, canvasLogicalWidth - 1));
    gridY = Math.max(0, Math.min(gridY, canvasLogicalHeight - 1));

    // Get the color data from the center of the target pixel cell
    const canvasX = (gridX + 0.5) * pixelSize;
    const canvasY = (gridY + 0.5) * pixelSize;
    const pixelData = ctx.getImageData(Math.floor(canvasX), Math.floor(canvasY), 1, 1).data;

    // Convert RGBA to hex
    const r = pixelData[0];
    const g = pixelData[1];
    const b = pixelData[2];
    // Ensure components are padded to two digits if needed
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();


    currentColor = hexColor;
    colorPicker.value = hexColor; // Update the color input
    console.log(`Picked color: ${hexColor} at grid (${gridX}, ${gridY})`);

    // Optionally switch back to pencil tool after picking
    // setActiveTool(pencilToolBtn);
    // currentTool = 'pencil';
}


function handleDrawStart(e) {
    e.preventDefault(); // Prevent default actions like text selection or scrolling
    
    // Save state *before* single-click actions like fill or picker start
    // For drag actions (pencil, eraser), we'll save state on mouseup (handleDrawEnd)
    if (currentTool === 'fill' || currentTool === 'picker') {
        // saveState(); // Save state before the action modifies the canvas
        // Let's always save state *after* an action completes for simplicity now
    }
    
    isDrawing = true;
    const { x, y } = getMousePos(e);
    lastDrawCoords = { x, y }; // Reset last coords

    // Perform the drawing action
    if (currentTool === 'pencil') {
        drawPixel(x, y, currentColor);
    } else if (currentTool === 'eraser') {
        drawPixel(x, y, ERASER_COLOR);
    } else if (currentTool === 'fill') {
        fillArea(x, y, currentColor);
         // Save state AFTER fill completes
        saveState(); 
        isDrawing = false; // Fill happens on click, not drag
    } else if (currentTool === 'picker') {
         pickColor(x, y);
         // Picker doesn't change canvas state, so no saveState() needed here
         isDrawing = false; // Picker also happens on click
    }
    console.log(`Draw Start (${currentTool}): Grid(${x}, ${y})`);
}

function handleDrawMove(e) {
    if (!isDrawing || currentTool === 'fill' || currentTool === 'picker') return; // Don't draw move for fill/picker
    e.preventDefault();
    const { x, y } = getMousePos(e);

     // Optimization: Only draw if the grid coordinates have changed
    if (x === lastDrawCoords.x && y === lastDrawCoords.y) {
        return;
    }

    if (currentTool === 'pencil') {
        drawLine(lastDrawCoords.x, lastDrawCoords.y, x, y, currentColor);
    } else if (currentTool === 'eraser') {
         // Use white for eraser line
        drawLine(lastDrawCoords.x, lastDrawCoords.y, x, y, ERASER_COLOR);
    }
    // Fill and Picker don't draw on move

    lastDrawCoords = { x, y }; // Update last coordinates
    // console.log(`Draw Move (${currentTool}): Grid(${x}, ${y})`); // Can be noisy
}

function handleDrawEnd(e) {
    if (!isDrawing) return;
    e.preventDefault();
    isDrawing = false;
    
    // Save state after a drawing stroke (pencil/eraser drag) is finished
    if (currentTool === 'pencil' || currentTool === 'eraser') {
       saveState();
    }

    lastDrawCoords = { x: -1, y: -1 }; // Reset last coords
    console.log("Draw End");
}

// --- Image Conversion ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                uploadedImage = img; // Store the loaded image object
                convertImageBtn.disabled = false; // Enable the convert button
                console.log("Image uploaded successfully:", file.name);
                showModal(`Image "${file.name}" loaded. Adjust pixelation level and click 'Convert'.`);
                // Optionally, display a preview (could be complex)
            }
            img.onerror = function() {
                console.error("Error loading image.");
                showModal("Error loading the image file.");
                uploadedImage = null;
                convertImageBtn.disabled = true;
            }
            img.src = e.target.result;
        }
        reader.onerror = function() {
            console.error("Error reading file.");
             showModal("Error reading the image file.");
            uploadedImage = null;
            convertImageBtn.disabled = true;
        }
        reader.readAsDataURL(file);
    } else {
        console.warn("No file selected or file is not an image.");
        showModal("Please select a valid image file (PNG, JPG, GIF, etc.).");
        uploadedImage = null;
        convertImageBtn.disabled = true;
    }
     // Reset file input to allow uploading the same file again
     if (event.target) event.target.value = null;
}

function convertImageToPixelArt() {
    if (!uploadedImage) {
        showModal("No image uploaded to convert.");
        console.warn("Convert button clicked but no image is loaded.");
        return;
    }

    console.log("Starting image conversion...");
    showModal("Converting image... please wait.", false); // Show non-closable modal

    // Clear the main canvas before drawing the pixelated version
     // Use the canvas background color (white)
    clearCanvas(false);

    const conversionPixelSize = parseInt(imagePixelSizeSlider.value, 10); // How many original pixels to average

    // --- More sophisticated conversion: Average color within blocks ---
     const sourceCanvas = document.createElement('canvas');
     const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
     // Check if uploadedImage is valid and has dimensions
     if (!uploadedImage || !uploadedImage.width || !uploadedImage.height) {
         console.error("Uploaded image is invalid or has no dimensions.");
         showModal("Failed to process uploaded image.");
         closeModal(); // Close the "converting" message if it was shown
         return;
     }
     sourceCanvas.width = uploadedImage.width;
     sourceCanvas.height = uploadedImage.height;
     sourceCtx.drawImage(uploadedImage, 0, 0);
     const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;


    console.log(`Converting based on canvas size: ${canvasLogicalWidth}x${canvasLogicalHeight}`);

    for (let y = 0; y < canvasLogicalHeight; y++) {
        for (let x = 0; x < canvasLogicalWidth; x++) {
            // Calculate the region in the *original* image corresponding to this pixel cell
            const startXOriginal = Math.floor(x * (uploadedImage.width / canvasLogicalWidth));
            const startYOriginal = Math.floor(y * (uploadedImage.height / canvasLogicalHeight));
            // Determine the size of the block in the original image
            const blockWidthOriginal = Math.max(1, Math.floor(uploadedImage.width / canvasLogicalWidth));
            const blockHeightOriginal = Math.max(1, Math.floor(uploadedImage.height / canvasLogicalHeight));
            const endXOriginal = startXOriginal + blockWidthOriginal;
            const endYOriginal = startYOriginal + blockHeightOriginal;

            let r = 0, g = 0, b = 0, count = 0;

            // Iterate over the corresponding block in the original image data
            for (let sy = startYOriginal; sy < endYOriginal; sy++) {
                for (let sx = startXOriginal; sx < endXOriginal; sx++) {
                     // Clamp coordinates just in case
                     const clampedSx = Math.max(0, Math.min(sx, uploadedImage.width - 1));
                     const clampedSy = Math.max(0, Math.min(sy, uploadedImage.height - 1));
                     const index = (clampedSy * uploadedImage.width + clampedSx) * 4;
                     // Ensure sourceData is valid and index is within bounds
                      if (sourceData && index >= 0 && index + 3 < sourceData.length) {
                         r += sourceData[index];
                         g += sourceData[index + 1];
                         b += sourceData[index + 2];
                         count++;
                     } else {
                         // Log an error or handle missing data?
                         // console.warn(`Invalid index ${index} for source data at (${clampedSx}, ${clampedSy})`);
                     }
                }
            }

            if (count > 0) {
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);
                const avgColor = `rgb(${r}, ${g}, ${b})`;
                ctx.fillStyle = avgColor;
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
    }


    console.log("Image conversion finished.");
    updateGrid(); // Redraw grid if needed
    closeModal(); // Close the "converting" message
    showModal("Image conversion complete!");
    saveInitialState(); // Treat image conversion as a new initial state for history
}

// --- Canvas Actions ---
function clearCanvas(redrawGrid = true) {
    // Use the defined eraser/background color
    ctx.fillStyle = ERASER_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    console.log("Canvas cleared.");
    if (redrawGrid) {
        updateGrid();
    }
    saveInitialState(); // Clear canvas resets history to this new blank state
}

function exportCanvas() {
     // Create a temporary canvas scaled to the logical size for a clean export
     const exportCanvas = document.createElement('canvas');
     exportCanvas.width = canvasLogicalWidth;
     exportCanvas.height = canvasLogicalHeight;
     const exportCtx = exportCanvas.getContext('2d');

     // Disable image smoothing for crisp pixels
     exportCtx.imageSmoothingEnabled = false;

     // Draw the current canvas content onto the export canvas, scaling down
     exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

     // Create download link
     const link = document.createElement('a');
     link.download = `pixel-art-${Date.now()}.png`;
     link.href = exportCanvas.toDataURL('image/png'); // Get data URL from the *export* canvas
     link.click();
     console.log("Canvas exported as PNG.");
}

// --- Tool Selection ---
function setActiveTool(selectedButton) {
    // Remove active class from all tool buttons
    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active', 'bg-blue-400', 'text-white'));
    // Add active classes to the selected button
    selectedButton.classList.add('active', 'bg-blue-400', 'text-white');
    // Update currentTool state
    // Ensure the button ID exists before processing
     if (selectedButton && selectedButton.id) {
         currentTool = selectedButton.id.replace('Tool', '').replace('Btn', '').toLowerCase(); // e.g., 'pencilTool' -> 'pencil'
         console.log("Active tool changed to:", currentTool);
     } else {
         console.warn("setActiveTool called with invalid button:", selectedButton);
         currentTool = 'pencil'; // Default to pencil if error
         // Optionally apply active style to default pencil button here
         if (pencilToolBtn) {
             pencilToolBtn.classList.add('active', 'bg-blue-400', 'text-white');
         }
     }

    // Update cursor style based on tool
     switch (currentTool) {
        case 'pencil':
        case 'eraser':
        case 'fill':
             canvas.style.cursor = 'crosshair';
             break;
        case 'picker':
             canvas.style.cursor = 'copy'; // Or 'eyedropper' if supported, but 'copy' is common
             break;
        default:
             canvas.style.cursor = 'default';
     }
}

// --- Modal ---
function showModal(message, closable = true) {
    modalMessageText.textContent = message;
    messageModal.style.display = 'flex'; // Use flex to enable centering (already set by Tailwind class, but good for clarity)
    const closeButton = messageModal.querySelector('span[onclick="closeModal()"]'); // More specific selector
    const okButton = messageModal.querySelector('button[onclick="closeModal()"]'); // More specific selector

    if (closeButton && okButton) {
         if (closable) {
             closeButton.style.display = 'block'; // Or 'inline' depending on float
             okButton.style.display = 'inline-block'; // Or 'block' depending on layout
         } else {
             closeButton.style.display = 'none';
             okButton.style.display = 'none';
         }
     } else {
         console.error("Modal close or OK button not found!");
     }
}

function closeModal() {
    messageModal.style.display = 'none';
}

// --- Event Listeners ---
function addEventListeners() {
    // Drawing listeners (Mouse)
    canvas.addEventListener('mousedown', handleDrawStart);
    canvas.addEventListener('mousemove', handleDrawMove);
    canvas.addEventListener('mouseup', handleDrawEnd);
    canvas.addEventListener('mouseleave', handleDrawEnd); // Stop drawing if mouse leaves canvas

     // Drawing listeners (Touch) - Map touch events to mouse handlers
    canvas.addEventListener('touchstart', handleDrawStart, { passive: false }); // passive: false to allow preventDefault
    canvas.addEventListener('touchmove', handleDrawMove, { passive: false });
    canvas.addEventListener('touchend', handleDrawEnd);
    canvas.addEventListener('touchcancel', handleDrawEnd); // Handle cancelled touches

    // Tool selection - Add checks for element existence
    if (pencilToolBtn) pencilToolBtn.addEventListener('click', () => setActiveTool(pencilToolBtn));
    if (eraserToolBtn) eraserToolBtn.addEventListener('click', () => setActiveTool(eraserToolBtn));
    if (fillToolBtn) fillToolBtn.addEventListener('click', () => setActiveTool(fillToolBtn));
    if (pickerToolBtn) pickerToolBtn.addEventListener('click', () => setActiveTool(pickerToolBtn));


    // Color picker
    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        console.log("Color changed:", currentColor);
    });

    // Pixel size slider (brush size)
    if (pixelSizeSlider) {
        pixelSizeSlider.addEventListener('input', (e) => {
            brushSize = parseInt(e.target.value, 10);
             if(pixelSizeLabel) pixelSizeLabel.textContent = brushSize;
             console.log("Brush size changed:", brushSize);
        });
     }

     // Canvas size select
     if (canvasSizeSelect) canvasSizeSelect.addEventListener('change', resizeCanvas);


    // Grid toggle
    if (gridToggle) {
        gridToggle.addEventListener('change', (e) => {
            showGrid = e.target.checked;
            updateGrid();
        });
     }

    // Image upload
     if (imageUpload) imageUpload.addEventListener('change', handleImageUpload);

    // Image pixel size slider
     if (imagePixelSizeSlider) {
         imagePixelSizeSlider.addEventListener('input', (e) => {
             if (imagePixelSizeLabel) imagePixelSizeLabel.textContent = e.target.value;
             console.log("Image pixelation level changed:", e.target.value);
         });
     }

    // Convert button
     if (convertImageBtn) convertImageBtn.addEventListener('click', convertImageToPixelArt);

    // Clear canvas button
     if (clearCanvasBtn) {
         clearCanvasBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the canvas? This cannot be undone.")) {
                clearCanvas();
            }
         });
     }

    // Export button
     if (exportBtn) exportBtn.addEventListener('click', exportCanvas);

    // Undo/Redo Buttons
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

     // Close modal button (within the modal)
     // Handled by inline onclick for simplicity, but could be added here too.

     // Prevent context menu on canvas (optional, prevents right-click menu)
     canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// --- Run Initialization ---
// Use DOMContentLoaded for better reliability than window.onload
 document.addEventListener('DOMContentLoaded', initialize); 

// --- History Management ---
function saveState() {
    // Optimization: If the canvas hasn't changed since the last save, don't save again.
    // This simple check uses the data URL; more robust checks could compare ImageData.
    const currentStateDataUrl = canvas.toDataURL();
    if (historyStack.length > 0 && historyStack[historyStack.length - 1] === currentStateDataUrl) {
        // console.log("Canvas state unchanged, not saving history.");
        return;
    }
    
    // If we were in an undone state, clear the redo stack
    if (redoStack.length > 0) {
        console.log("New action after undo, clearing redo stack.");
        redoStack = [];
    }

    // Add the current state to the history stack
    historyStack.push(currentStateDataUrl);

    // Limit history size
    if (historyStack.length > MAX_HISTORY_SIZE) {
        historyStack.shift(); // Remove the oldest state
    }

    console.log(`State saved. History size: ${historyStack.length}, Redo size: ${redoStack.length}`);
    updateUndoRedoButtons();
}

function saveInitialState() {
    currentHistoryState = canvas.toDataURL();
    historyStack = [currentHistoryState]; // Start with the initial state
    redoStack = [];
    updateUndoRedoButtons();
    console.log("Initial state saved.");
}

function undo() {
    if (historyStack.length <= 1) { // Can't undo the initial state
        console.log("Cannot undo further.");
        return;
    }

    // Pop the current state from history and push it to redo
    const currentState = historyStack.pop();
    redoStack.push(currentState);

    // Get the previous state from history
    const prevStateDataUrl = historyStack[historyStack.length - 1];

    console.log(`Undo: History size: ${historyStack.length}, Redo size: ${redoStack.length}`);
    restoreStateFromDataUrl(prevStateDataUrl);
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) {
        console.log("Cannot redo further.");
        return;
    }

    // Pop the state from redo and push it back to history
    const nextStateDataUrl = redoStack.pop();
    historyStack.push(nextStateDataUrl);
    
    // Limit history size again if redo pushes it over
    if (historyStack.length > MAX_HISTORY_SIZE) {
        historyStack.shift();
    }

    console.log(`Redo: History size: ${historyStack.length}, Redo size: ${redoStack.length}`);
    restoreStateFromDataUrl(nextStateDataUrl);
    updateUndoRedoButtons();
}

function restoreStateFromDataUrl(dataUrl) {
    const img = new Image();
    img.onload = function() {
        // Clear canvas first before drawing the restored image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        console.log("Canvas state restored.");
        // Optional: If grid needs redraw after restore
        // updateGrid(); 
    }
    img.onerror = function() {
        console.error("Failed to load image data for undo/redo.");
    }
    img.src = dataUrl;
}

function updateUndoRedoButtons() {
    undoBtn.disabled = historyStack.length <= 1; // Disable if only initial state is left
    redoBtn.disabled = redoStack.length === 0;
} 