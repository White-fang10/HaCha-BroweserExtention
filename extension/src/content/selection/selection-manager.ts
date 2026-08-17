import { SelectionState } from "./selection-state.js";
import { SelectionOverlay } from "./selection-overlay.js";
import { captureSelection } from "./selection-capture.js";
import { preprocessForOCR } from "../ocr/image-preprocessor.js";
import { ocrManager } from "../ocr/ocr-manager.js";
import { OCRConfirmationPanel } from "../ui/ocr-confirmation.js";
import { VerificationResultPanel, VerificationLoadingPanel } from "../ui/verification-result.js";
import { stateMachine, HaChaState } from "../ui/state.js";
import { uiRoot } from "../ui/root.js";
import { generateRequestId } from "../../shared/utils.js";
import { SelectionRect } from "../../shared/types.js";
import { sanitizeText } from "../ui/xss-protection.js";

export class SelectionManager {
    private state: SelectionState;
    private overlay: SelectionOverlay | null = null;
    private currentRequestId: string = "";
    private selectionRect: SelectionRect | null = null;

    // Bound handlers for clean removal
    private handlePointerDown = this.onPointerDown.bind(this);
    private handlePointerMove = this.onPointerMove.bind(this);
    private handlePointerUp = this.onPointerUp.bind(this);
    private handleKeyDown = this.onKeyDown.bind(this);
    private handleMessage = this.onMessage.bind(this);

    constructor() {
        this.state = new SelectionState();
        // Listen for messages from background
        chrome.runtime.onMessage.addListener(this.handleMessage);
    }

    /**
     * Start the selection flow.
     */
    public start() {
        if (stateMachine.getState() !== "IDLE") {
            console.log("[HaCha][Selection] Already active, ignoring start request.");
            return;
        }

        console.log("[HaCha][Selection] Starting selection mode");
        stateMachine.transition("SELECTING");

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

    /**
     * Cancel selection and return to IDLE.
     */
    public cancel() {
        console.log("[HaCha][Selection] Cancelling selection");
        this.cleanup();
        stateMachine.transition("IDLE");
    }

    /**
     * Stop and cleanup.
     */
    public stop() {
        this.cleanup();
        stateMachine.forceTransition("IDLE");
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
    }

    private onPointerDown(e: PointerEvent) {
        if (stateMachine.getState() !== "SELECTING") return;
        if (e.button !== 0) return;

        stateMachine.transition("DRAWING");
        this.state.startDrawing(e.clientX, e.clientY);
        this.overlay?.getHostElement().setPointerCapture(e.pointerId);
        this.overlay?.updateCutout(this.state.getSelectionRect());
    }

    private onPointerMove(e: PointerEvent) {
        if (stateMachine.getState() !== "DRAWING") return;

        this.state.updateDrawing(e.clientX, e.clientY);
        this.overlay?.updateCutout(this.state.getSelectionRect());
    }

    private async onPointerUp(e: PointerEvent) {
        if (stateMachine.getState() !== "DRAWING") return;

        this.overlay?.getHostElement().releasePointerCapture(e.pointerId);

        const valid = this.state.finishDrawing();
        if (!valid) {
            console.log("[HaCha][Selection] Selection too small, resetting");
            stateMachine.transition("SELECTING");
            this.overlay?.clearCutout();
            this.overlay?.setInstruction("Selection too small — drag a larger area.");
            setTimeout(() => {
                if (stateMachine.getState() === "SELECTING" && this.overlay) {
                    this.overlay.setInstruction("Drag to select a claim. ESC to cancel.");
                }
            }, 2000);
            return;
        }

        stateMachine.transition("CAPTURED");
        this.selectionRect = this.state.getSelectionRect();
        console.log("[HaCha][Selection] Selection finalized", this.selectionRect);

        // Remove the selection overlay before capturing the screenshot so it doesn't
        // appear in the captured image
        this.cleanup();

        // Start the OCR pipeline
        await this.runOCRPipeline(this.selectionRect);
    }

    private async runOCRPipeline(rect: SelectionRect) {
        try {
            // 1. Capture the selected region from a tab screenshot
            console.log("[HaCha][OCR] Capturing selection...");
            const rawCanvas = await captureSelection(rect);

            // 2. Preprocess the image for better OCR results
            const processedCanvas = preprocessForOCR(rawCanvas);

            // 3. Run Tesseract OCR (client-side only — image never leaves the browser)
            stateMachine.transition("OCR_PROCESSING");
            const ocrResult = await ocrManager.recognize(processedCanvas);

            // Clean up canvas
            rawCanvas.width = 1;
            rawCanvas.height = 1;
            processedCanvas.width = 1;
            processedCanvas.height = 1;

            // 4. Show confirmation panel for the user to review/edit
            stateMachine.transition("CLAIM_CONFIRMATION", { selectionRect: rect, ocrText: ocrResult.text });

            const panel = new OCRConfirmationPanel(ocrResult, async (action, confirmedText) => {
                if (action === "verify") {
                    console.log("[HaCha] Claim confirmed for verification:", confirmedText);
                    stateMachine.transition("VERIFYING", { claimText: confirmedText });

                    // Show loading panel
                    const loadingPanel = new VerificationLoadingPanel(confirmedText, rect);
                    uiRoot.registerComponent("loading", loadingPanel);
                    loadingPanel.attach();

                    // Send to background for verification
                    this.currentRequestId = generateRequestId();
                    await this.sendVerifyClaim(confirmedText, this.currentRequestId);

                } else if (action === "select-again") {
                    // Restart the selection flow
                    stateMachine.transition("IDLE");
                    this.start();
                }
            });
            uiRoot.registerComponent("ocr-confirm", panel);
            panel.attach();

        } catch (err) {
            console.error("[HaCha][OCR] Pipeline error:", err);
            stateMachine.transition("ERROR", { errorMessage: err instanceof Error ? err.message : "OCR failed. Please try again." });
            this.showError(err instanceof Error ? err.message : "OCR failed. Please try again.");
            stateMachine.transition("IDLE");
        }
    }

    /**
     * Send verification request to background service worker.
     */
    private async sendVerifyClaim(claim: string, requestId: string): Promise<void> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: "VERIFY_CLAIM", claim, requestId },
                (response: { success: boolean; data?: any; error?: string }) => {
                    if (chrome.runtime.lastError) {
                        console.error("[HaCha][Selection] Background communication error:", chrome.runtime.lastError.message);
                        this.handleVerificationError("Cannot connect to background service");
                        resolve();
                        return;
                    }

                    if (!response.success) {
                        this.handleVerificationError(response.error || "Verification failed");
                        resolve();
                        return;
                    }

                    // Success will be handled via VERIFICATION_RESULT message
                    resolve();
                }
            );
        });
    }

    /**
     * Handle verification error.
     */
    private handleVerificationError(message: string): void {
        uiRoot.removeComponent("loading");
        stateMachine.transition("ERROR", { errorMessage: message });
        this.showError(message);
        // Return to IDLE after showing error
        setTimeout(() => stateMachine.transition("IDLE"), 5000);
    }

    /**
     * Show error notification.
     */
    private showError(message: string): void {
        const errorHost = document.createElement("div");
        errorHost.style.cssText = "position:fixed;top:20px;right:20px;background:#7f1d1d;color:#fca5a5;padding:14px 18px;border-radius:8px;font-family:sans-serif;font-size:14px;z-index:2147483647;";
        errorHost.textContent = sanitizeText(message);
        document.body.appendChild(errorHost);
        setTimeout(() => errorHost.parentNode?.removeChild(errorHost), 5000);
    }

    /**
     * Handle messages from background service worker.
     */
    private onMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
        if (!message || !message.type) return false;

        switch (message.type) {
            case "VERIFICATION_RESULT":
                if (message.requestId === this.currentRequestId) {
                    this.handleVerificationResult(message.result);
                }
                return false; // Async response not needed

            case "VERIFICATION_PROGRESS":
                if (message.requestId === this.currentRequestId) {
                    this.updateLoadingProgress(message.stage);
                }
                return false;

            case "ERROR":
                if (message.requestId === this.currentRequestId) {
                    this.handleVerificationError(message.message);
                }
                return false;

            case "ACTIVATE_HACHA":
                this.start();
                sendResponse({ success: true });
                return true;

            default:
                return false;
        }
    }

    /**
     * Handle verification result from background.
     */
    private handleVerificationResult(result: { success: boolean; data?: any; error?: string }): void {
        uiRoot.removeComponent("loading");

        if (!result.success) {
            this.handleVerificationError(result.error || "Verification failed");
            return;
        }

        if (!result.data) {
            this.handleVerificationError("No verification data received");
            return;
        }

        // Validate the response structure
        if (!result.data.verdict || !result.data.normalizedClaim) {
            this.handleVerificationError("Invalid verification response");
            return;
        }

        console.log("[HaCha] Verification result:", result.data);

        // Get selection rect from state machine context
        const context = stateMachine.getContext();
        const selectionRect = context.selectionRect;

        if (!selectionRect) {
            this.handleVerificationError("Selection context lost");
            return;
        }

        // Show result panel positioned near selection
        stateMachine.transition("RESULT", { verificationResult: result.data });
        const resultPanel = new VerificationResultPanel(result.data, selectionRect, (action) => {
            if (action === "verify-again") {
                stateMachine.transition("SELECTING");
                this.start();
            }
        });
        uiRoot.registerComponent("result", resultPanel);
        resultPanel.attach();
    }

    /**
     * Update loading panel progress stage.
     */
    private updateLoadingProgress(stage: string): void {
        const loadingPanel = uiRoot.getComponent("loading") as VerificationLoadingPanel | undefined;
        loadingPanel?.setProgressStage(stage);
    }

    private onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            this.cancel();
        }
    }

    /**
     * Clean up message listener.
     */
    public destroy() {
        this.cleanup();
        chrome.runtime.onMessage.removeListener(this.handleMessage);
    }
}