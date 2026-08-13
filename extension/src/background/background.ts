import { HaChaMessage } from "../shared/messages.js";
import { ActivationResponse } from "../shared/types.js";

console.log("[HaCha][Background] Service Worker started");

chrome.runtime.onMessage.addListener((message: HaChaMessage, sender, sendResponse) => {
    if (message.type === "ACTIVATE_HACHA") {
        console.log("[HaCha][Background] Activation requested");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];

            if (!activeTab || !activeTab.id) {
                sendResponse({ success: false, error: "Unable to identify active tab." });
                return;
            }

            console.log(`[HaCha][Background] Active tab: ${activeTab.id}`);

            if (activeTab.url?.startsWith("chrome://") || activeTab.url?.startsWith("edge://")) {
                sendResponse({ success: false, error: "HaCha cannot run on this page." });
                return;
            }

            chrome.tabs.sendMessage(activeTab.id, { type: "ACTIVATE_HACHA" }, (response: ActivationResponse) => {
                if (chrome.runtime.lastError) {
                    console.error("[HaCha][Background] Content script unavailable:", chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: "HaCha content module is unavailable. Please try refreshing the page." });
                } else {
                    sendResponse(response || { success: true });
                }
            });
        });

        return true; // async response
    }

    if (message.type === "CAPTURE_TAB") {
        console.log("[HaCha][Background] Tab capture requested");

        // captureVisibleTab requires the tab to be active; sender.tab.windowId ensures we capture the right window
        const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

        chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("[HaCha][Background] Tab capture failed:", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, dataUrl });
            }
        });

        return true; // async response
    }
});
