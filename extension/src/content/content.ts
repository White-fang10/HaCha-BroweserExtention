import { HaChaMessage } from "../shared/messages.js";
import { SelectionManager } from "./selection/selection-manager.js";

console.log("[HaCha][Content] Script injected");

// Singleton manager for the selection tool
const selectionManager = new SelectionManager();

chrome.runtime.onMessage.addListener((message: HaChaMessage, sender, sendResponse) => {
    if (message.type === "ACTIVATE_HACHA") {
        console.log("[HaCha][Content] Activation received");
        selectionManager.start();
        sendResponse({ success: true });
    }
});
