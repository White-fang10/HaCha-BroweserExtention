/**
 * Shadow DOM based verification result panel that shows fact-check results.
 * Positioned contextually near the user's selection.
 */
import {
    type VerificationData,
} from "../../shared/verification-types.js";
import {
    getVerdictLabel,
    getVerdictClass,
    formatTimestamp,
} from "../verification/verification-service.js";
import { calculatePosition, getViewport, type Rect, debounce, throttle } from "./positioning.js";
import { escapeHtml, sanitizeUrl } from "./xss-protection.js";

type ResultCallback = "dismiss" | "verify-again";

/**
 * Panel that displays verification results to the user.
 * Positioned contextually near the selection rectangle.
 */
export class VerificationResultPanel {
    private host: HTMLDivElement;
    private shadowRoot: ShadowRoot;
    private onAction: (action: ResultCallback) => void;

    private selectionRect: Rect;
    private position: { x: number; y: number; position: string } = { x: 0, y: 0, position: "right" };
    private scrollHandler: (() => void) | null = null;
    private resizeHandler: (() => void) | null = null;

    constructor(result: VerificationData, selectionRect: Rect, onAction: (action: ResultCallback) => void) {
        this.onAction = onAction;
        this.selectionRect = selectionRect;

        this.host = document.createElement("div");
        this.host.id = "hacha-verification-result-host";
        this.host.style.position = "fixed";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.host.style.width = "100vw";
        this.host.style.height = "100vh";
        this.host.style.zIndex = "2147483647";
        this.host.style.pointerEvents = "none";

        this.shadowRoot = this.host.attachShadow({ mode: "closed" });

        const style = document.createElement("style");
        style.textContent = `
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }

            .card-container {
                position: absolute;
                max-width: 90vw;
                max-height: 85vh;
                pointer-events: all;
            }

            .backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.3);
                display: flex;
                align-items: flex-start;
                justify-content: flex-start;
                pointer-events: all;
                z-index: -1;
            }

            .panel {
                background: #1f2937;
                color: #f9fafb;
                border-radius: 12px;
                padding: 20px;
                width: 380px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.4);
                animation: slideIn 0.2s ease;
                border: 1px solid #374151;
            }

            @keyframes slideIn {
                from { opacity: 0; transform: translateY(-8px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .header-title {
                font-size: 15px;
                font-weight: 600;
                color: #c7d2fe;
            }

            .close-btn {
                background: #374151;
                color: #e5e7eb;
                border: none;
                border-radius: 6px;
                width: 28px;
                height: 28px;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .close-btn:hover { background: #4b5563; }

            .verdict-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 10px;
            }

            .verdict-supported { background: #064e3b; color: #6ee7b7; }
            .verdict-false { background: #7f1d1d; color: #fca5a5; }
            .verdict-misleading { background: #78350f; color: #fcd34d; }
            .verdict-unverified { background: #374151; color: #9ca3af; }

            .verdict-icon { font-size: 18px; }

            .claim-box {
                background: #111827;
                border-radius: 6px;
                padding: 10px 12px;
                font-size: 13px;
                color: #e5e7eb;
                margin-bottom: 10px;
                line-height: 1.5;
                border-left: 3px solid #6366f1;
            }

            .section-title {
                font-size: 13px;
                font-weight: 600;
                color: #c7d2fe;
                margin-bottom: 6px;
                margin-top: 12px;
            }

            .explanation {
                font-size: 13px;
                color: #d1d5db;
                line-height: 1.6;
                max-height: 200px;
                overflow-y: auto;
            }

            .meta-row {
                display: flex;
                gap: 10px;
                margin-top: 8px;
                font-size: 12px;
                color: #6b7280;
                flex-wrap: wrap;
            }

            .meta-row .badge {
                background: #374151;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 11px;
            }

            .source {
                background: #111827;
                border-radius: 6px;
                padding: 8px 10px;
                margin-bottom: 6px;
                font-size: 12px;
            }

            .source a {
                color: #818cf8;
                text-decoration: none;
                font-weight: 500;
            }
            .source a:hover { text-decoration: underline; }

            .source .publisher { color: #9ca3af; font-size: 11px; }

            .no-sources {
                font-size: 12px;
                color: #6b7280;
                font-style: italic;
            }

            .expand-btn {
                background: transparent;
                color: #818cf8;
                border: none;
                font-size: 12px;
                cursor: pointer;
                padding: 4px 0;
                text-decoration: underline;
            }

            .actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }

            button.btn-primary, button.btn-secondary {
                padding: 8px 16px;
                border-radius: 6px;
                border: none;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.15s ease;
                flex: 1;
            }

            .btn-primary {
                background: #4f46e5;
                color: white;
            }
            .btn-primary:hover { background: #4338ca; }

            .btn-secondary {
                background: #374151;
                color: #e5e7eb;
            }
            .btn-secondary:hover { background: #4b5563; }

            /* Accessibility focus styles */
            button:focus-visible {
                outline: 2px solid #a5b4fc;
                outline-offset: 2px;
            }
        `;
        this.shadowRoot.appendChild(style);

        const cardContainer = document.createElement("div");
        cardContainer.className = "card-container";

        const panel = document.createElement("div");
        panel.className = "panel";

        const isExpanded = result.explanation.length > 200;
        const displayExplanation = isExpanded
            ? result.explanation.substring(0, 200) + "..."
            : result.explanation;

        panel.innerHTML = `
            <div class="header">
                <div class="header-title">HaCha Fact Check</div>
                <button id="btn-close" class="close-btn" aria-label="Close result">&times;</button>
            </div>

            <div class="verdict-badge ${getVerdictClass(result.verdict)}">
                <span class="verdict-icon">${this.getVerdictIcon(result.verdict)}</span>
                <span>${getVerdictLabel(result.verdict)}</span>
            </div>

            <div class="claim-box">${escapeHtml(result.normalizedClaim)}</div>

            <div class="section-title">Analysis</div>
            <div class="explanation" id="explanation-text">${escapeHtml(displayExplanation)}</div>
            ${isExpanded ? '<button id="btn-expand" class="expand-btn">Read full analysis</button>' : ''}

            <div class="meta-row">
                <span class="badge">Confidence: ${(result.confidence * 100).toFixed(0)}%</span>
                <span class="badge">Tier: ${result.sourceTier}</span>
                ${result.cached ? '<span class="badge">Cached</span>' : ''}
            </div>

            <div class="section-title">Sources</div>
            ${result.sources.length > 0
                ? result.sources.slice(0, 3).map(s => `
                    <div class="source">
                        <a href="${sanitizeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>
                        <div class="publisher">${escapeHtml(s.publisher)} &middot; ${escapeHtml(s.publishDate)}</div>
                    </div>
                `).join("")
                : '<div class="no-sources">No sources available for this claim.</div>'
            }
            ${result.sources.length > 3 ? `<div class="meta-row"><span class="badge">+${result.sources.length - 3} more sources</span></div>` : ''}

            <div class="actions">
                <button id="btn-retry" class="btn-secondary">Verify Again</button>
            </div>
        `;

        cardContainer.appendChild(panel);
        this.shadowRoot.appendChild(cardContainer);

        // Calculate position
        this.updatePosition();

        // Wire up event handlers
        setTimeout(() => {
            const closeBtn = this.shadowRoot.getElementById("btn-close");
            const retryBtn = this.shadowRoot.getElementById("btn-retry");
            const expandBtn = this.shadowRoot.getElementById("btn-expand");

            closeBtn?.addEventListener("click", () => {
                this.onAction("dismiss");
                this.detach();
            });

            retryBtn?.addEventListener("click", () => {
                this.onAction("verify-again");
                this.detach();
            });

            expandBtn?.addEventListener("click", () => {
                const textEl = this.shadowRoot.getElementById("explanation-text");
                if (textEl) {
                    textEl.textContent = result.explanation;
                    expandBtn.style.display = "none";
                }
            });
        }, 0);

        // Add scroll/resize handlers
        this.scrollHandler = throttle(() => this.handleScrollOrResize(), 100);
        this.resizeHandler = debounce(() => this.handleScrollOrResize(), 150);
        window.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true });
        window.addEventListener("resize", this.resizeHandler);
    }

    /**
     * Update card position based on current viewport and selection rect.
     */
    private updatePosition(): void {
        const viewport = getViewport();
        const cardContainer = this.shadowRoot.querySelector(".card-container") as HTMLDivElement | null;
        if (!cardContainer) return;

        const cardRect = cardContainer.getBoundingClientRect();
        const cardWidth = cardRect.width || 380;
        const cardHeight = cardRect.height || 200;

        const pos = calculatePosition({
            cardWidth,
            cardHeight,
            selectionRect: this.selectionRect,
            viewport,
        });

        this.position = pos;

        cardContainer.style.left = `${pos.x}px`;
        cardContainer.style.top = `${pos.y}px`;
    }

    /**
     * Handle scroll/resize events to reposition card.
     */
    private handleScrollOrResize(): void {
        // Small movement: reposition
        this.updatePosition();
    }

    private getVerdictIcon(verdict: string): string {
        switch (verdict) {
            case "SUPPORTED": return "✓";
            case "FALSE": return "✕";
            case "MISLEADING": return "⚠";
            default: return "?";
        }
    }

    public attach() {
        document.body.appendChild(this.host);
    }

    public detach() {
        if (this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
        // Clean up handlers
        if (this.scrollHandler) {
            window.removeEventListener("scroll", this.scrollHandler, { capture: true } as EventListenerOptions);
            this.scrollHandler = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener("resize", this.resizeHandler);
            this.resizeHandler = null;
        }
    }
}

/**
 * Loading/error panel for verification states.
 * Positioned contextually near the selection.
 */
export class VerificationLoadingPanel {
    private host: HTMLDivElement;
    private shadowRoot: ShadowRoot;
    private claimText: string;
    private selectionRect: Rect;

    constructor(claimText: string, selectionRect?: Rect) {
        this.claimText = claimText;
        this.selectionRect = selectionRect || {
            x: window.innerWidth / 2 - 100,
            y: window.innerHeight / 2 - 50,
            width: 200,
            height: 100,
        };

        this.host = document.createElement("div");
        this.host.id = "hacha-verification-loading-host";
        this.host.style.position = "fixed";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.host.style.width = "100vw";
        this.host.style.height = "100vh";
        this.host.style.zIndex = "2147483647";
        this.host.style.pointerEvents = "none";

        this.shadowRoot = this.host.attachShadow({ mode: "closed" });

        const style = document.createElement("style");
        style.textContent = `
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }

            .card-container {
                position: absolute;
                max-width: 90vw;
                pointer-events: all;
            }

            .panel {
                background: #1f2937;
                color: #f9fafb;
                border-radius: 12px;
                padding: 20px;
                width: 320px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.4);
                border: 1px solid #374151;
            }

            .spinner {
                width: 36px;
                height: 36px;
                border: 4px solid #374151;
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 14px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }

            .header { font-size: 14px; font-weight: 600; color: #c7d2fe; margin-bottom: 6px; text-align: center; }
            .progress-stage { font-size: 12px; color: #9ca3af; text-align: center; margin-bottom: 10px; }
            .claim-box {
                background: #111827;
                border-radius: 6px;
                padding: 8px 10px;
                font-size: 12px;
                color: #e5e7eb;
                max-height: 80px;
                overflow-y: auto;
                text-align: left;
                line-height: 1.5;
            }

            .error { color: #fca5a5; font-size: 13px; margin-top: 10px; }
        `;
        this.shadowRoot.appendChild(style);

        const cardContainer = document.createElement("div");
        cardContainer.className = "card-container";

        const panel = document.createElement("div");
        panel.className = "panel";
        panel.id = "loading-panel-content";
        panel.innerHTML = `
            <div class="spinner"></div>
            <div class="header">Verifying claim...</div>
            <div class="progress-stage" id="progress-stage">Checking existing fact-checks</div>
            <div class="claim-box">${escapeHtml(this.claimText)}</div>
        `;

        cardContainer.appendChild(panel);
        this.shadowRoot.appendChild(cardContainer);

        this.updatePosition();
    }

    private updatePosition(): void {
        const viewport = getViewport();
        const cardContainer = this.shadowRoot.querySelector(".card-container") as HTMLDivElement | null;
        if (!cardContainer) return;

        const cardRect = cardContainer.getBoundingClientRect();
        const cardWidth = cardRect.width || 320;
        const cardHeight = cardRect.height || 150;

        const pos = calculatePosition({
            cardWidth,
            cardHeight,
            selectionRect: this.selectionRect,
            viewport,
        });

        cardContainer.style.left = `${pos.x}px`;
        cardContainer.style.top = `${pos.y}px`;
    }

    public setProgressStage(stage: string) {
        const stageEl = this.shadowRoot.getElementById("progress-stage");
        if (stageEl) {
            stageEl.textContent = stage;
        }
    }

    public showError(message: string) {
        const panel = this.shadowRoot.getElementById("loading-panel-content");
        if (panel) {
            panel.innerHTML = `
                <div class="header" style="color:#fca5a5">Verification Failed</div>
                <div class="error">${escapeHtml(message)}</div>
                <div class="claim-box">${escapeHtml("Please try again or verify manually.")}</div>
            `;
        }
    }

    public attach() {
        document.body.appendChild(this.host);
    }

    public detach() {
        if (this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
    }
}