import { HaChaMessage } from "../shared/messages.js";
import { ActivationResponse } from "../shared/types.js";

console.log("[HaCha][Content] Script injected");

let isActive = false;
let indicatorElement: HTMLDivElement | null = null;

chrome.runtime.onMessage.addListener((message: HaChaMessage, sender, sendResponse) => {
    if (message.type === "ACTIVATE_HACHA") {
        console.log("[HaCha][Content] Activation received");
        
        if (isActive) {
            console.log("[HaCha][Content] Already active. Reusing state.");
            sendResponse({ success: true });
            return;
        }

        isActive = true;
        showActivationIndicator();
        sendResponse({ success: true });
    }
});

function showActivationIndicator() {
    if (indicatorElement) return;

    indicatorElement = document.createElement("div");
    indicatorElement.id = "hacha-activation-indicator";
    indicatorElement.style.position = "fixed";
    indicatorElement.style.top = "20px";
    indicatorElement.style.right = "20px";
    indicatorElement.style.padding = "15px 20px";
    indicatorElement.style.backgroundColor = "#4F46E5";
    indicatorElement.style.color = "#FFFFFF";
    indicatorElement.style.borderRadius = "8px";
    indicatorElement.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    indicatorElement.style.fontFamily = "sans-serif";
    indicatorElement.style.fontSize = "14px";
    indicatorElement.style.fontWeight = "bold";
    indicatorElement.style.zIndex = "999999";
    indicatorElement.style.transition = "opacity 0.3s ease";

    indicatorElement.innerHTML = `
        <div>HaCha AI Activated</div>
        <div style="font-size: 12px; font-weight: normal; margin-top: 4px; opacity: 0.8;">
            Region selection coming in the next phase.
        </div>
    `;

    document.body.appendChild(indicatorElement);

    // Remove indicator automatically and reset state to keep DOM clean
    setTimeout(() => {
        if (indicatorElement && indicatorElement.parentNode) {
            indicatorElement.style.opacity = "0";
            setTimeout(() => {
                indicatorElement?.parentNode?.removeChild(indicatorElement);
                indicatorElement = null;
                isActive = false;
                console.log("[HaCha][Content] Session concluded, DOM cleaned up.");
            }, 300);
        }
    }, 3000);
}
