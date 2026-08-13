import { SelectionRect } from "../../shared/types.js";

export class SelectionOverlay {
    private host: HTMLDivElement;
    private shadowRoot: ShadowRoot;
    
    private backdrop: HTMLDivElement;
    private cutout: HTMLDivElement;
    private instructionBar: HTMLDivElement;

    constructor() {
        this.host = document.createElement("div");
        this.host.id = "hacha-selection-host";
        this.host.style.position = "fixed";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.host.style.width = "100vw";
        this.host.style.height = "100vh";
        this.host.style.zIndex = "2147483647"; // Max z-index
        this.host.style.cursor = "crosshair";
        
        this.shadowRoot = this.host.attachShadow({ mode: "closed" });

        // Add scoped CSS to shadow root
        const style = document.createElement("style");
        style.textContent = `
            * {
                box-sizing: border-box;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .backdrop {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.45);
                pointer-events: none;
            }
            .cutout {
                position: absolute;
                border: 2px solid #4F46E5;
                background-color: transparent;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
                pointer-events: none;
                display: none;
            }
            .instruction-bar {
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #1f2937;
                color: #ffffff;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                pointer-events: none;
                z-index: 10;
                display: flex;
                gap: 16px;
                white-space: nowrap;
            }
            .instruction-bar span.key {
                background-color: #374151;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
            }
        `;
        this.shadowRoot.appendChild(style);

        // Container to implement the cutout effect
        // We use a trick: the cutout div has a massive box-shadow that acts as the dimming layer
        const clipContainer = document.createElement("div");
        clipContainer.style.position = "absolute";
        clipContainer.style.top = "0";
        clipContainer.style.left = "0";
        clipContainer.style.width = "100%";
        clipContainer.style.height = "100%";
        clipContainer.style.overflow = "hidden";
        clipContainer.style.pointerEvents = "none";
        
        this.backdrop = document.createElement("div");
        this.backdrop.className = "backdrop";
        
        this.cutout = document.createElement("div");
        this.cutout.className = "cutout";
        
        this.instructionBar = document.createElement("div");
        this.instructionBar.className = "instruction-bar";
        this.instructionBar.innerHTML = `
            <span>Drag to select a claim</span>
            <span><span class="key">ESC</span> to cancel</span>
        `;
        
        clipContainer.appendChild(this.backdrop);
        clipContainer.appendChild(this.cutout);
        this.shadowRoot.appendChild(clipContainer);
        this.shadowRoot.appendChild(this.instructionBar);
    }

    public attach() {
        if (!this.host.parentNode) {
            document.body.appendChild(this.host);
        }
    }

    public detach() {
        if (this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
    }

    public getHostElement(): HTMLDivElement {
        return this.host;
    }

    public updateCutout(rect: SelectionRect) {
        this.backdrop.style.display = "none"; // Hide full backdrop, rely on cutout box-shadow
        this.cutout.style.display = "block";
        this.cutout.style.left = `${rect.x}px`;
        this.cutout.style.top = `${rect.y}px`;
        this.cutout.style.width = `${rect.width}px`;
        this.cutout.style.height = `${rect.height}px`;
    }

    public clearCutout() {
        this.cutout.style.display = "none";
        this.backdrop.style.display = "block";
    }

    public setInstruction(message: string) {
        this.instructionBar.innerHTML = `<span>${message}</span>`;
    }
}
