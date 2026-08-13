import { SelectionState } from "./selection-state.js";
import { SelectionOverlay } from "./selection-overlay.js";
import { captureSelection } from "./selection-capture.js";
import { preprocessForOCR } from "../ocr/image-preprocessor.js";
import { ocrManager } from "../ocr/ocr-manager.js";
import { OCRConfirmationPanel } from "../ui/ocr-confirmation.js";

export class SelectionManager {
    private state: SelectionState;
    private overlay: SelectionOverlay | null = null;

    // Bound handlers for clean removal
    private handlePointerDown = this.onPointerDown.bind(this);
    private handlePointerMove = this.onPointerMove.bind(this);
    private handlePointerUp = this.onPointerUp.bind(this);
    private handleKeyDown = this.onKeyDown.bind(this);

    constructor() {
        this.state = new SelectionState();
    }

    public start() {
        if (this.state.getState() !== "INACTIVE") {
            console.log("[HaCha][Selection] Already active, ignoring start request.");
            return;
        }

        console.log("[HaCha][Selection] Starting selection mode");
        this.state.setState("SELECTING");

        this.overlay = new SelectionOverlay();
        this.overlay.attach();

        const host = this.overlay.getHostElement();
        host.addEventListener("pointerdown", this.handlePointerDown);
        host.addEventListener("pointermove", this.handlePointerMove);
        host.addEventListener("pointerup", this.handlePointerUp);
        document.addEventListener("keydown", this.handleKeyDown);

        host.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
        host.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
    }

    public cancel() {
        console.log("[HaCha][Selection] Cancelling selection");
        this.cleanup();
    }

    public stop() {
        this.cleanup();
    }

    private cleanup() {
        if (this.overlay) {
            const host = this.overlay.getHostElement();
            host.removeEventListener("pointerdown", this.handlePointerDown);
            host.removeEventListener("pointermove", this.handlePointerMove);
            host.removeEventListener("pointerup", this.handlePointerUp);
            this.overlay.detach();
            this.overlay = null;
        }
        document.removeEventListener("keydown", this.handleKeyDown);
        this.state.setState("INACTIVE");
    }

    private onPointerDown(e: PointerEvent) {
        if (this.state.getState() !== "SELECTING") return;
        if (e.button !== 0) return;

        this.state.startDrawing(e.clientX, e.clientY);
        this.overlay?.getHostElement().setPointerCapture(e.pointerId);
        this.overlay?.updateCutout(this.state.getSelectionRect());
    }

    private onPointerMove(e: PointerEvent) {
        if (this.state.getState() !== "DRAWING") return;

        this.state.updateDrawing(e.clientX, e.clientY);
        this.overlay?.updateCutout(this.state.getSelectionRect());
    }

    private async onPointerUp(e: PointerEvent) {
        if (this.state.getState() !== "DRAWING") return;

        this.overlay?.getHostElement().releasePointerCapture(e.pointerId);

        const valid = this.state.finishDrawing();
        if (!valid) {
            console.log("[HaCha][Selection] Selection too small, resetting");
            this.overlay?.clearCutout();
            this.overlay?.setInstruction("Selection too small — drag a larger area.");
            setTimeout(() => {
                if (this.state.getState() === "SELECTING" && this.overlay) {
                    this.overlay.setInstruction("Drag to select a claim. ESC to cancel.");
                }
            }, 2000);
            return;
        }

        const rect = this.state.getSelectionRect();
        console.log("[HaCha][Selection] Selection finalized", rect);

        // Remove the selection overlay before capturing the screenshot so it doesn't
        // appear in the captured image
        this.cleanup();

        // Start the OCR pipeline
        await this.runOCRPipeline(rect);
    }

    private async runOCRPipeline(rect: import("../../shared/types.js").SelectionRect) {
        try {
            // 1. Capture the selected region from a tab screenshot
            console.log("[HaCha][OCR] Capturing selection...");
            const rawCanvas = await captureSelection(rect);

            // 2. Preprocess the image for better OCR results
            const processedCanvas = preprocessForOCR(rawCanvas);

            // 3. Run Tesseract OCR (client-side only — image never leaves the browser)
            const ocrResult = await ocrManager.recognize(processedCanvas);

            // 4. Show confirmation panel for the user to review/edit
            const panel = new OCRConfirmationPanel(ocrResult, (action, confirmedText) => {
                if (action === "verify") {
                    console.log("[HaCha] Claim confirmed for verification:", confirmedText);
                    // Phase 4 will send confirmedText to the backend here
                } else if (action === "select-again") {
                    // Restart the selection flow
                    this.state.setState("INACTIVE");
                    this.start();
                }
            });
            panel.attach();

        } catch (err) {
            console.error("[HaCha][OCR] Pipeline error:", err);
            // Show a simple error notification
            const errorHost = document.createElement("div");
            errorHost.style.cssText = "position:fixed;top:20px;right:20px;background:#7f1d1d;color:#fca5a5;padding:14px 18px;border-radius:8px;font-family:sans-serif;font-size:14px;z-index:2147483647;";
            errorHost.textContent = err instanceof Error ? err.message : "OCR failed. Please try again.";
            document.body.appendChild(errorHost);
            setTimeout(() => errorHost.parentNode?.removeChild(errorHost), 5000);

            // Allow retrying
            this.state.setState("INACTIVE");
        }
    }

    private onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            this.cancel();
        }
    }
}
