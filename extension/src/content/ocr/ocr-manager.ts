import { createWorker, Worker } from "tesseract.js";
import { OCRResult } from "../../shared/types.js";

type OCRManagerState = "UNINITIALIZED" | "INITIALIZING" | "READY" | "PROCESSING" | "ERROR";

/**
 * Singleton OCR manager that lazily initializes a Tesseract.js worker
 * and reuses it across multiple selections to avoid repeated init overhead.
 */
class OCRManager {
    private state: OCRManagerState = "UNINITIALIZED";
    private worker: Worker | null = null;

    /**
     * Runs OCR on a preprocessed canvas element.
     * Initializes the worker on first call; reuses it on subsequent calls.
     */
    public async recognize(canvas: HTMLCanvasElement): Promise<OCRResult> {
        if (this.state === "ERROR") {
            // Reset so the user can try again
            this.worker = null;
            this.state = "UNINITIALIZED";
        }

        if (this.state === "UNINITIALIZED") {
            await this.initialize();
        }

        // Wait if already initializing (shouldn't happen normally with singleton usage)
        while (this.state === "INITIALIZING") {
            await new Promise(r => setTimeout(r, 100));
        }

        if (this.state !== "READY" || !this.worker) {
            throw new Error("[HaCha][OCR] Worker is not ready.");
        }

        this.state = "PROCESSING";
        const startTime = performance.now();
        console.log("[HaCha][OCR] Processing started");

        try {
            const result = await this.worker.recognize(canvas);
            const processingTimeMs = Math.round(performance.now() - startTime);

            const text = result.data.text.trim();
            const confidence = result.data.confidence;

            console.log(`[HaCha][OCR] Processing complete. Confidence: ${confidence.toFixed(1)}. Duration: ${processingTimeMs}ms`);

            this.state = "READY";

            return {
                text,
                confidence,
                language: "eng",
                processingTimeMs,
                characterCount: text.length,
                wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
                source: "local-tesseract"
            };
        } catch (err) {
            this.state = "ERROR";
            console.error("[HaCha][OCR] Processing failed:", err);
            throw new Error("OCR failed. Please try again.");
        }
    }

    private async initialize(): Promise<void> {
        this.state = "INITIALIZING";
        console.log("[HaCha][OCR] Worker initializing...");

        try {
            // Point the worker script to the locally bundled file
            // The workerPath must be accessible within the extension's origin
            this.worker = await createWorker("eng", 1, {
                workerPath: chrome.runtime.getURL("dist/worker.min.js"),
                langPath: "https://tessdata.projectnaptha.com/4.0.0",
                corePath: chrome.runtime.getURL("dist/tesseract.esm.min.js"),
                logger: (m) => {
                    if (m.status === "loading tesseract core") {
                        console.log("[HaCha][OCR] Loading core engine...");
                    } else if (m.status === "loading language traineddata") {
                        console.log("[HaCha][OCR] Loading language model...");
                    } else if (m.status === "initialized") {
                        console.log("[HaCha][OCR] Worker ready.");
                    }
                }
            });

            this.state = "READY";
            console.log("[HaCha][OCR] Worker ready.");
        } catch (err) {
            this.state = "ERROR";
            console.error("[HaCha][OCR] Worker initialization failed:", err);
            throw new Error("Unable to initialize local OCR.");
        }
    }

    public async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
        this.state = "UNINITIALIZED";
        console.log("[HaCha][OCR] Worker terminated.");
    }
}

// Export a single shared instance
export const ocrManager = new OCRManager();
