import { HaChaMessage } from "../shared/messages.js";
import { ActivationResponse } from "../shared/types.js";

console.log("[HaCha][Background] Service Worker started");

chrome.runtime.onMessage.addListener((message: HaChaMessage, sender, sendResponse) => {
    if (message.type === "ACTIVATE_HACHA") {
        console.log("[HaCha][Background] Activation requested");
        
        // Find the active tab in the current window
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            
            if (!activeTab || !activeTab.id) {
                console.error("[HaCha][Background] Unable to identify active tab.");
                sendResponse({ success: false, error: "Unable to identify active tab." });
                return;
            }

            console.log(`[HaCha][Background] Active tab: ${activeTab.id}`);
            
            // Check for restricted pages (e.g. chrome://)
            if (activeTab.url?.startsWith("chrome://") || activeTab.url?.startsWith("edge://")) {
                console.warn("[HaCha][Background] Cannot run on restricted browser pages.");
                sendResponse({ success: false, error: "HaCha cannot run on this page." });
                return;
            }

            // Forward the activation message to the content script in the active tab
            chrome.tabs.sendMessage(activeTab.id, { type: "ACTIVATE_HACHA" }, (response: ActivationResponse) => {
                if (chrome.runtime.lastError) {
                    console.error("[HaCha][Background] Injection failure or content script not ready:", chrome.runtime.lastError.message);
                    // This error often means the content script is not injected on this tab.
                    // To handle this properly, we could programmatically inject it here using chrome.scripting.executeScript,
                    // but since our manifest.json injects it on <all_urls>, it's likely a restricted page we missed or the page needs refreshing.
                    sendResponse({ success: false, error: "HaCha content module is unavailable. Please try refreshing the page." });
                } else {
                    console.log("[HaCha][Background] Content script responded successfully", response);
                    sendResponse(response || { success: true });
                }
            });
        });

        // Return true to indicate we will send a response asynchronously
        return true;
    }
});
