/**
 * UI Root - Phase 11
 * Single extension root with Shadow DOM isolation.
 * Prevents duplicate overlays and provides CSS isolation.
 */

import { stateMachine, HaChaState } from "./state.js";

export interface UIComponent {
    attach(): void;
    detach(): void;
}

class UIRoot {
    private host: HTMLDivElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private components: Map<string, UIComponent> = new Map();
    private stateUnsubscribe: (() => void) | null = null;

    constructor() {
        this.createRoot();
        this.subscribeToState();
    }

    /**
     * Create the root element with Shadow DOM.
     */
    private createRoot(): void {
        // Check for existing root and clean up
        const existing = document.getElementById("hacha-root");
        if (existing) {
            console.warn("[HaCha][UIRoot] Existing root found, cleaning up");
            existing.remove();
        }

        this.host = document.createElement("div");
        this.host.id = "hacha-root";
        this.host.style.position = "fixed";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.host.style.width = "100vw";
        this.host.style.height = "100vh";
        this.host.style.zIndex = "2147483647";
        this.host.style.pointerEvents = "none";

        // Use closed shadow root for stronger isolation
        this.shadowRoot = this.host.attachShadow({ mode: "closed" });

        // Inject base styles that won't leak to page
        const style = document.createElement("style");
        style.textContent = `
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            :host {
                all: initial;
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 2147483647;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            /* Reset any inherited styles */
            :host * {
                all: initial;
                box-sizing: border-box;
            }
            /* Ensure our elements don't inherit page styles */
            :host div, :host button, :host span, :host a, :host textarea, :host input {
                all: initial;
                box-sizing: border-box;
            }
        `;
        this.shadowRoot.appendChild(style);

        document.body.appendChild(this.host);
        console.log("[HaCha][UIRoot] Root created with Shadow DOM");
    }

    /**
     * Subscribe to state machine changes for automatic cleanup.
     */
    private subscribeToState(): void {
        this.stateUnsubscribe = stateMachine.subscribe((state, context) => {
            // Clean up components when transitioning to IDLE
            if (state === "IDLE") {
                this.clearAllComponents();
            }
        });
    }

    /**
     * Get the shadow root for component mounting.
     */
    getShadowRoot(): ShadowRoot {
        if (!this.shadowRoot) {
            throw new Error("UIRoot not initialized");
        }
        return this.shadowRoot;
    }

    /**
     * Register a component.
     */
    registerComponent(name: string, component: UIComponent): void {
        // Detach existing component with same name
        const existing = this.components.get(name);
        if (existing) {
            try {
                existing.detach();
            } catch (err) {
                console.warn(`[HaCha][UIRoot] Error detaching ${name}:`, err);
            }
        }
        this.components.set(name, component);
    }

    /**
     * Get a registered component.
     */
    getComponent(name: string): UIComponent | undefined {
        return this.components.get(name);
    }

    /**
     * Attach a component to the shadow root.
     */
    attachComponent(name: string): void {
        const component = this.components.get(name);
        if (component) {
            component.attach();
        }
    }

    /**
     * Detach a component.
     */
    detachComponent(name: string): void {
        const component = this.components.get(name);
        if (component) {
            component.detach();
        }
    }

    /**
     * Detach and remove a component.
     */
    removeComponent(name: string): void {
        const component = this.components.get(name);
        if (component) {
            try {
                component.detach();
            } catch (err) {
                console.warn(`[HaCha][UIRoot] Error removing ${name}:`, err);
            }
            this.components.delete(name);
        }
    }

    /**
     * Clear all components.
     */
    clearAllComponents(): void {
        for (const [name, component] of this.components) {
            try {
                component.detach();
            } catch (err) {
                console.warn(`[HaCha][UIRoot] Error clearing ${name}:`, err);
            }
        }
        this.components.clear();
    }

    /**
     * Check if root exists.
     */
    exists(): boolean {
        return this.host !== null && document.body.contains(this.host);
    }

    /**
     * Destroy the root and all components.
     */
    destroy(): void {
        this.clearAllComponents();
        if (this.host?.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
        this.host = null;
        this.shadowRoot = null;
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        console.log("[HaCha][UIRoot] Destroyed");
    }
}

/**
 * Singleton UI Root instance.
 */
export const uiRoot = new UIRoot();