/**
 * Simple image preprocessing pipeline to improve OCR accuracy.
 * Strategy: upscale if small → grayscale → mild contrast boost.
 * We avoid over-processing: no blur, no thresholding by default.
 */
export function preprocessForOCR(source: HTMLCanvasElement): HTMLCanvasElement {
    const MIN_WIDTH = 600;
    const SCALE_FACTOR = 2;

    let width = source.width;
    let height = source.height;

    // Step 1: Upscale if the image is small
    const needsUpscale = width < MIN_WIDTH;
    if (needsUpscale) {
        width = width * SCALE_FACTOR;
        height = height * SCALE_FACTOR;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;

    // Draw the source (possibly scaled)
    ctx.drawImage(source, 0, 0, width, height);

    // Step 2: Grayscale via pixel manipulation
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Luminosity formula for better perceptual grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        // Alpha (data[i+3]) stays unchanged
    }

    // Step 3: Mild contrast boost (linear stretch)
    const contrastFactor = 1.2; // 1.0 = no change, values above increase contrast
    const intercept = 128 * (1 - contrastFactor);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] * contrastFactor + intercept));
        data[i + 1] = data[i];
        data[i + 2] = data[i];
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}
