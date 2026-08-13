import { SelectionRect } from "../../shared/types.js";

interface CaptureResponse {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

/**
 * Requests a screenshot of the visible tab from the background service worker,
 * then crops it to the user's selection rect and returns a canvas element.
 * The image never leaves the browser — only text extracted by OCR will later
 * be sent to the backend.
 */
export async function captureSelection(rect: SelectionRect): Promise<HTMLCanvasElement> {
    // Ask the background service worker to screenshot the tab
    const response = await new Promise<CaptureResponse>((resolve) => {
        chrome.runtime.sendMessage({ type: "CAPTURE_TAB" }, (res: CaptureResponse) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                resolve(res);
            }
        });
    });

    if (!response.success || !response.dataUrl) {
        throw new Error(response.error || "Tab capture failed");
    }

    // Decode the screenshot into an ImageBitmap
    const img = await createImageBitmap(
        await fetch(response.dataUrl).then(r => r.blob())
    );

    // Create a canvas sized to the selection and draw only the cropped region
    const dpr = rect.devicePixelRatio || 1;
    const cropX = Math.round(rect.x * dpr);
    const cropY = Math.round(rect.y * dpr);
    const cropW = Math.round(rect.width * dpr);
    const cropH = Math.round(rect.height * dpr);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    img.close();

    return canvas;
}
