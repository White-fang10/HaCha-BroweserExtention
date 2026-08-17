import { OCRResult } from "../../shared/types.js";
import { escapeHtml, sanitizeUrl } from "./xss-protection.js";

type PanelCallback = "verify" | "select-again" | "dismiss";

/**
 * Shadow DOM based confirmation panel that shows OCR results to the user
 * and lets them verify, edit the text, or start over.
 */
export class OCRConfirmationPanel {
    private host: HTMLDivElement;
    private shadowRoot: ShadowRoot;
    private onAction: (action: PanelCallback, text: string) => void;

    constructor(result: OCRResult, onAction: (action: PanelCallback, text: string) => void) {
        this.onAction = onAction;

        this.host = document.createElement("div");
        this.host.id = "hacha-ocr-panel-host";
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
                width: 480px;
                max-width: 90vw;
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

            .ocr-text {
                width: 100%;
                background: #111827;
                color: #e5e7eb;
                border: 1px solid #374151;
                border-radius: 6px;
                padding: 10px 12px;
                font-size: 14px;
                line-height: 1.6;
                resize: vertical;
                min-height: 90px;
                outline: none;
                font-family: inherit;
            }

            .ocr-text:focus {
                border-color: #6366f1;
            }

            .meta {
                margin-top: 8px;
                font-size: 12px;
                color: #6b7280;
                display: flex;
                gap: 12px;
            }

            .meta .badge {
                background: #374151;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 11px;
            }

            .meta .badge.low {
                background: #7f1d1d;
                color: #fca5a5;
            }

            .warning {
                margin-top: 10px;
                font-size: 12px;
                color: #f59e0b;
                background: rgba(245,158,11,0.1);
                border-radius: 6px;
                padding: 8px 10px;
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

            .btn-verify {
                background: #4f46e5;
                color: white;
                flex: 1;
            }
            .btn-verify:hover { background: #4338ca; }

            .btn-retry {
                background: #374151;
                color: #e5e7eb;
            }
            .btn-retry:hover { background: #4b5563; }
        `;
        this.shadowRoot.appendChild(style);

        const backdrop = document.createElement("div");
        backdrop.className = "backdrop";

        const panel = document.createElement("div");
        panel.className = "panel";

        const isLowConfidence = result.confidence < 60;
        const isEmptyText = result.text.trim().length === 0;

        panel.innerHTML = `
            <div class="header">HaCha extracted:</div>
            <div class="subheader">${result.wordCount} word${result.wordCount !== 1 ? "s" : ""} detected &middot; ${result.processingTimeMs}ms</div>
            ${isEmptyText
                ? `<div class="warning">⚠️ No readable text was detected. Try selecting a larger or clearer region.</div>`
                : `<textarea id="ocr-text-area" class="ocr-text">${this.escapeHtml(result.text)}</textarea>
                   <div class="meta">
                     <span class="badge ${isLowConfidence ? 'low' : ''}">OCR confidence: ${result.confidence.toFixed(1)}%</span>
                     <span class="badge">${result.source}</span>
                   </div>
                   ${isLowConfidence ? '<div class="warning">⚠️ OCR confidence is low. Review the text before verifying.</div>' : ''}
                   <div class="actions">
                     <button id="btn-verify" class="btn-verify">Verify Claim</button>
                     <button id="btn-retry" class="btn-retry">Select Again</button>
                   </div>`
            }
            ${isEmptyText ? `<div class="actions"><button id="btn-retry" class="btn-retry">Select Again</button></div>` : ''}
        `;

        backdrop.appendChild(panel);
        this.shadowRoot.appendChild(backdrop);

        // Wire buttons after appending to shadow root
        setTimeout(() => {
            const verifyBtn = this.shadowRoot.getElementById("btn-verify");
            const retryBtn = this.shadowRoot.getElementById("btn-retry");
            const textArea = this.shadowRoot.getElementById("ocr-text-area") as HTMLTextAreaElement | null;

            verifyBtn?.addEventListener("click", () => {
                this.onAction("verify", textArea?.value ?? result.text);
                this.detach();
            });

            retryBtn?.addEventListener("click", () => {
                this.onAction("select-again", "");
                this.detach();
            });
        }, 0);
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
