import { HaChaMessage } from "../shared/messages.js";
import { SelectionManager } from "./selection/selection-manager.js";
import { stateMachine, HaChaState } from "./ui/state.js";
import { uiRoot } from "./ui/root.js";

console.log("[HaCha][Content] Script injected");

// Singleton manager for the selection tool
const selectionManager = new SelectionManager();

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message: HaChaMessage, sender, sendResponse) => {
    if (message.type === "ACTIVATE_HACHA") {
        console.log("[HaCha][Content] Activation received");
        selectionManager.start();
        sendResponse({ success: true });
        return true;
    }

    if (message.type === "VERIFICATION_RESULT") {
        // This will be handled by selectionManager's message handler
        sendResponse({ success: true });
        return true;
    }

    if (message.type === "VERIFICATION_PROGRESS") {
        sendResponse({ success: true });
        return true;
    }

    if (message.type === "ERROR") {
        sendResponse({ success: true });
        return true;
    }

    return false;
});

// Handle extension context invalidation
chrome.runtime.onConnect.addListener(() => {
    // Keep service worker alive if needed
});

// Clean up on unload
window.addEventListener("unload", () => {
    selectionManager.destroy();
    uiRoot.destroy();
    stateMachine.forceTransition("IDLE");
});

// Export for debugging
if (typeof window !== "undefined") {
    (window as any).__HACHA_DEBUG__ = {
        stateMachine,
        selectionManager,
        uiRoot,
    };
}