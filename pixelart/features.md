# Pixel Art Generator Features & Improvements

This document outlines the current features, requested additions, and potential improvements for the Pixel Art Generator.

## Current Features (v1.0 - Tailwind v4 Base)

*   **Drawing Tools:**
    *   Pencil (with variable brush size)
    *   Eraser (with variable brush size)
    *   Fill Bucket
    *   Color Picker (Eyedropper)
*   **Color Management:**
    *   Main Color Selector
    *   Basic Static Color Palette
*   **Canvas Control:**
    *   Variable Canvas Size (32x32, 64x64, 128x128, 256x256)
    *   Clear Canvas (with confirmation)
    *   Toggle Grid Visibility
*   **Image Conversion:**
    *   Upload Image (PNG, JPG, GIF)
    *   Convert Uploaded Image to Pixel Art (using color averaging)
    *   Adjustable Pixelation Level for Conversion
*   **Export:**
    *   Export Canvas as PNG (at logical resolution)
*   **UI/UX:**
    *   Basic Tool Selection Highlight
    *   Modal Dialog for Messages
    *   Responsive Layout (Basic)
    *   Touch Support (Basic Drawing)

## Requested New Features (Target: v2.0)

*Absolutely Needed:*

1.  **Mirror Draw (X-axis):** Draw symmetrically across the vertical centerline.
2.  **Mirror Draw (Y-axis):** Draw symmetrically across the horizontal centerline.
3.  **Right-Click Erase:** Use the right mouse button as a quick eraser tool.
4.  **Line Tool:** Draw straight lines (respecting brush size).
5.  **Rectangle Tool:** Draw rectangle outlines or filled rectangles (respecting brush size/color).
6.  **Circle Tool:** Draw circle outlines or filled circles (respecting brush size/color).
7.  **Selection Tool:** Select a rectangular area of the canvas.
8.  **Move Tool:** Move the content within the current selection (or the whole layer if layers are implemented).
9.  **Undo:** Undo the last drawing action(s).
10. **Redo:** Redo the last undone action(s).
11. **Zoom Tool/Controls:** Zoom in and out of the canvas.
12. **Pan Tool/Controls:** Pan the view when zoomed in (e.g., spacebar + drag).
13. **Save Project:** Save the current canvas state (including layers, size, etc.) to a local file.
14. **Load Project:** Load a previously saved project file.
15. **Customizable Palettes:** Add/remove colors from the palette, save/load palettes.
16. **Opacity Control:** Adjust the opacity of the drawing tool.
17. **Layers:** Basic layer support (add, delete, merge, reorder, visibility toggle).
18. **Brush Shape Preview:** Show a preview of the current brush size/shape near the cursor.
19. **Keyboard Shortcuts:** Add shortcuts for common tools and actions (e.g., P for Pencil, E for Eraser, Ctrl+Z for Undo).
20. **Stamp Tool:** Select an area and use it as a repeatable stamp/brush.

## Potential Optimizations & Improvements (Target: v2.0+)

1.  **Performance:** Use `requestAnimationFrame` for smoother drawing loops.
2.  **Performance:** Debounce frequent events like `mousemove` and window resize.
3.  **Performance:** Optimize Flood Fill algorithm (e.g., non-recursive scanline fill).
4.  **Performance:** Use Offscreen Canvas for drawing operations, especially previews or complex shapes, before drawing to the main canvas.
5.  **Performance:** Optimize `getImageData` / `putImageData` usage (minimize calls).
6.  **Performance:** Consider Web Workers for heavy tasks like image conversion or complex algorithms.
7.  **Code Structure:** Implement a simple State Management pattern for better organization (especially with Undo/Redo, Layers).
8.  **Code Structure:** Use ES Modules for better code organization (`script.js` could be split further).
9.  **UX:** Improve touch gestures (pinch-to-zoom, two-finger pan).
10. **UX:** Add tooltips or hints for buttons and controls.
11. **UX:** Better visual feedback during operations (e.g., selection marquee animation).
12. **UX:** More refined UI theme/styling.
13. **UX:** Canvas scaling options (fit to view, actual size).
14. **Bug Fix:** Ensure drawing lines (`drawLine`) correctly handles brush size > 1.
15. **Bug Fix:** Address potential issues with color picking/filling at canvas edges or with transparency.
16. **Feature:** Add different brush shapes (e.g., square, circle).
17. **Feature:** Add dithering options (for drawing or image conversion).
18. **Feature:** Animation frame support (simple frame management, onion skinning, GIF export).
19. **Feature:** Tilemap support (drawing across tile boundaries, tile preview).
20. **Accessibility:** Improve keyboard navigation and ARIA attributes for better accessibility. 