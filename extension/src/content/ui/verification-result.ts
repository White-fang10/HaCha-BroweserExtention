/**
 * Shadow DOM based verification result panel that shows fact-check results.
 */
import {
    type VerificationData,
} from "../../shared/verification-types.js";
import {
    getVerdictLabel,
    getVerdictClass,
    formatTimestamp,
} from "../verification/verification-service.js";

type ResultCallback = "dismiss" | "verify-again";

/**
 * Panel that displays verification results to the user.
 */
export class VerificationResultPanel {
    private host: HTMLDivElement;
    private shadowRoot: ShadowRoot;
    private onAction: (action: ResultCallback) => void;

    constructor(result: VerificationData, onAction: (action: ResultCallback) => void) {
        this.onAction = onAction;

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

            .backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.55);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: all;
            }

            .panel {
                background: #1f2937;
                color: #f9fafb;
                border-radius: 12px;
                padding: 24px;
                width: 520px;
                max-width: 90vw;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                animation: slideIn 0.2s ease;
            }

            @keyframes slideIn {
                from { opacity: 0; transform: translateY(-12px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            .header {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 4px;
                color: #c7d2fe;
            }

            .subheader {
                font-size: 12px;
                color: #9ca3af;
                margin-bottom: 14px;
            }

            .verdict-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 12px;
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
                font-size: 14px;
                color: #e5e7eb;
                margin-bottom: 12px;
                line-height: 1.5;
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
            }

            .meta-row {
                display: flex;
                gap: 12px;
                margin-top: 8px;
                font-size: 12px;
                color: #6b7280;
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

            .actions {
                display: flex;
                gap: 10px;
                margin-top: 18px;
            }

            button {
                padding: 10px 18px;
                border-radius: 6px;
                border: none;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.15s ease;
            }

            .btn-close {
                background: #374151;
                color: #e5e7eb;
                flex: 1;
            }
            .btn-close:hover { background: #4b5563; }

            .btn-retry {
                background: #4338ca;
                color: white;
            }
            .btn-retry:hover { background: #3730a3; }
        `;
        this.shadowRoot.appendChild(style);

        const backdrop = document.createElement("div");
        backdrop.className = "backdrop";

        const panel = document.createElement("div");
        panel.className = "panel";

        panel.innerHTML = `
            <div class="header">HaCha Fact Check Result</div>
            <div class="subheader">${formatTimestamp(result.timestamp)}</div>

            <div class="verdict-badge ${getVerdictClass(result.verdict)}">
                <span class="verdict-icon">${this.getVerdictIcon(result.verdict)}</span>
                <span>${getVerdictLabel(result.verdict)}</span>
            </div>

            <div class="claim-box">${this.escapeHtml(result.normalizedClaim)}</div>

            <div class="section-title">Analysis</div>
            <div class="explanation">${this.escapeHtml(result.explanation)}</div>

            <div class="meta-row">
                <span class="badge">Confidence: ${(result.confidence * 100).toFixed(0)}%</span>
                <span class="badge">Tier: ${result.sourceTier}</span>
                ${result.cached ? '<span class="badge">Cached</span>' : ''}
            </div>

            <div class="section-title">Sources</div>
            ${result.sources.length > 0
                ? result.sources.map(s => `
                    <div class="source">
                        <a href="${this.escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(s.title)}</a>
                        <div class="publisher">${this.escapeHtml(s.publisher)} &middot; ${this.escapeHtml(s.publishDate)}</div>
                    </div>
                `).join("")
                : '<div class="no-sources">No sources available for this claim.</div>'
            }

            <div class="actions">
                <button id="btn-retry" class="btn-retry">Verify Again</button>
                <button id="btn-close" class="btn-close">Close</button>
            </div>
        `;

        backdrop.appendChild(panel);
        this.shadowRoot.appendChild(backdrop);

        setTimeout(() => {
            const retryBtn = this.shadowRoot.getElementById("btn-retry");
            const closeBtn = this.shadowRoot.getElementById("btn-close");

            retryBtn?.addEventListener("click", () => {
                this.onAction("verify-again");
                this.detach();
            });

            closeBtn?.addEventListener("click", () => {
                this.onAction("dismiss");
                this.detach();
            });
        }, 0);
    }

    private getVerdictIcon(verdict: string): string {
        switch (verdict) {
            case "SUPPORTED": return "✓";
            case "FALSE": return "✕";
            case "MISLEADING": return "⚠";
            default: return "?";
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    public attach() {
        document.body.appendChild(this.host);
    }

    public detach() {
        this.host.parentNode?.removeChild(this.host);
    }
}

/**
 * Loading/error panel for verification states.
 */
export class VerificationLoadingPanel {
    private host: HTMLDivElement;
    private shadowRoot: ShadowRoot;

    constructor(claimText: string) {
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
            .backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.55);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: all;
            }
            .panel {
                background: #1f2937;
                color: #f9fafb;
                border-radius: 12px;
                padding: 24px;
                width: 420px;
                max-width: 90vw;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            }
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #374151;
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 16px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .header { font-size: 15px; font-weight: 600; color: #c7d2fe; margin-bottom: 8px; }
            .claim-box {
                background: #111827;
                border-radius: 6px;
                padding: 10px 12px;
                font-size: 13px;
                color: #e5e7eb;
                margin-top: 12px;
                max-height: 120px;
                overflow-y: auto;
                text-align: left;
                line-height: 1.5;
            }
            .error { color: #fca5a5; font-size: 13px; margin-top: 12px; }
        `;
        this.shadowRoot.appendChild(style);

        const backdrop = document.createElement("div");
        backdrop.className = "backdrop";

        const panel = document.createElement("div");
        panel.className = "panel";
        panel.id = "loading-panel-content";
        panel.innerHTML = `
            <div class="spinner"></div>
            <div class="header">Verifying claim...</div>
            <div class="claim-box">${this.escapeHtml(claimText)}</div>
        `;

        backdrop.appendChild(panel);
        this.shadowRoot.appendChild(backdrop);
    }

    public showError(message: string) {
        const panel = this.shadowRoot.getElementById("loading-panel-content");
        if (panel) {
            panel.innerHTML = `
                <div class="header" style="color:#fca5a5">Verification Failed</div>
                <div class="error">${this.escapeHtml(message)}</div>
                <div class="claim-box">${this.escapeHtml("Please try again or verify manually.")}</div>
            `;
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    public attach() {
        document.body.appendChild(this.host);
    }

    public detach() {
        this.host.parentNode?.removeChild(this.host);
    }
}
