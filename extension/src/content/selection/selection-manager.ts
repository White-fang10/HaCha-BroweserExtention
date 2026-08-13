import { SelectionState } from "./selection-state.js";
import { SelectionOverlay } from "./selection-overlay.js";

export class SelectionManager {
    private state: SelectionState;
    private overlay: SelectionOverlay | null = null;
    
    // Bind event handlers so they can be removed properly
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

        // We listen on the overlay host element to capture pointer events globally
        const host = this.overlay.getHostElement();
        host.addEventListener("pointerdown", this.handlePointerDown);
        host.addEventListener("pointermove", this.handlePointerMove);
        host.addEventListener("pointerup", this.handlePointerUp);
        
        // Keydown should be global to catch ESC
        document.addEventListener("keydown", this.handleKeyDown);
        
        // Prevent default scrolling and interactions on the host
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
        
        // Only accept primary button (usually left click)
        if (e.button !== 0) return;
        
        this.state.startDrawing(e.clientX, e.clientY);
        
        // Capture pointer to ensure we get events even if the pointer leaves the element or window
        if (this.overlay) {
            this.overlay.getHostElement().setPointerCapture(e.pointerId);
            this.overlay.updateCutout(this.state.getSelectionRect());
        }
    }

    private onPointerMove(e: PointerEvent) {
        if (this.state.getState() !== "DRAWING") return;
        
        this.state.updateDrawing(e.clientX, e.clientY);
        
        if (this.overlay) {
            this.overlay.updateCutout(this.state.getSelectionRect());
        }
    }

    private onPointerUp(e: PointerEvent) {
        if (this.state.getState() !== "DRAWING") return;
        
        if (this.overlay) {
            this.overlay.getHostElement().releasePointerCapture(e.pointerId);
        }

        const valid = this.state.finishDrawing();
        if (valid) {
            console.log("[HaCha][Selection] Selection finalized", this.state.getSelectionRect());
            if (this.overlay) {
                this.overlay.setInstruction("Region selected (Phase 3 will handle OCR). <span class='key'>ESC</span> to exit.");
            }
        } else {
            console.log("[HaCha][Selection] Selection too small, resetting");
            if (this.overlay) {
                this.overlay.clearCutout();
                // We show an error temporarily then revert back to instructions
                const prevHTML = this.overlay['instructionBar'].innerHTML;
                this.overlay.setInstruction("<span style='color: #f87171;'>Selection too small, try again.</span>");
                setTimeout(() => {
                    if (this.state.getState() === "SELECTING" && this.overlay) {
                        this.overlay['instructionBar'].innerHTML = prevHTML;
                    }
                }, 2000);
            }
        }
    }

    private onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            this.cancel();
        }
    }
}
