/**
 * Background Service Worker - Phase 11
 * Handles extension communication with the HaCha backend gateway.
 * Manages verification requests, tab capture, and message routing.
 */

import {
    type HaChaMessage,
    type ContentToBackgroundMessage,
    type VerificationResult,
    type ActivationResponse,
    type CaptureResponse,
    type VerifyResponse,
} from "../shared/messages.js";

console.log("[HaCha][Background] Service Worker started");

// Track active verification requests per tab
const activeRequests = new Map<number, string>(); // tabId -> requestId

// Backend configuration
const BACKEND_CONFIG = {
    BASE_URL: "http://localhost:3000",
    VERIFY_ENDPOINT: "/api/verify",
    HEALTH_ENDPOINT: "/api/health",
    TIMEOUT_MS: 30000,
} as const;

chrome.runtime.onMessage.addListener((
    message: HaChaMessage,
    sender,
    sendResponse
) => {
    if (message.type === "ACTIVATE_HACHA") {
        handleActivateHacha(sender, sendResponse);
        return true;
    }

    if (message.type === "CAPTURE_TAB") {
        handleCaptureTab(sender, sendResponse);
        return true;
    }

    if (message.type === "VERIFY_CLAIM") {
        handleVerifyClaim(message, sender, sendResponse);
        return true;
    }

    if (message.type === "GET_STATUS") {
        handleGetStatus(sendResponse);
        return true;
    }

    if (message.type === "DEACTIVATE_HACHA") {
        handleDeactivateHacha(sender, sendResponse);
        return true;
    }

    return false;
});

/**
 * Handle extension activation request from popup.
 */
function handleActivateHacha(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ActivationResponse) => void
): void {
    console.log("[HaCha][Background] Activation requested");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.id) {
            sendResponse({ success: false, error: "Unable to identify active tab." });
            return;
        }

        console.log(`[HaCha][Background] Active tab: ${activeTab.id}`);

        const tabUrl = activeTab.url ?? "";
        if (tabUrl.startsWith("chrome://") || tabUrl.startsWith("edge://")) {
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
}

/**
 * Handle tab capture for OCR.
 */
function handleCaptureTab(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: CaptureResponse) => void
): void {
    console.log("[HaCha][Background] Tab capture requested");

    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || "Tab capture failed";
            console.error("[HaCha][Background] Tab capture failed:", errorMessage);
            sendResponse({ success: false, error: errorMessage });
        } else {
            sendResponse({ success: true, dataUrl });
        }
    });
}

/**
 * Handle verification request from content script.
 */
async function handleVerifyClaim(
    message: Extract<ContentToBackgroundMessage, { type: "VERIFY_CLAIM" }>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: VerifyResponse) => void
): Promise<void> {
    const { claim, requestId } = message;
    const tabId = sender.tab?.id;

    if (!tabId) {
        sendResponse({ success: false, error: "No tab ID available" });
        return;
    }

    console.log(`[HaCha][Background] Verification request for tab ${tabId}, request ${requestId}`);

    // Track this request for this tab
    activeRequests.set(tabId, requestId);

    const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT_MS);

        try {
            // Notify content script of progress
            notifyProgress(tabId, requestId, "Checking existing fact-checks...");

            const response = await fetch(`${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.VERIFY_ENDPOINT}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    claim,
                    request_id: requestId,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Check if this request is still the active one for this tab
            if (activeRequests.get(tabId) !== requestId) {
                console.log(`[HaCha][Background] Stale request ${requestId} ignored for tab ${tabId}`);
                return;
            }

            notifyProgress(tabId, requestId, "Retrieving evidence...");

            const result = (await response.json()) as VerifyResponse;

            if (result.success === false) {
                const errorMsg = result.error || `HTTP ${response.status}: Verification failed`;
                notifyError(tabId, requestId, errorMsg);
                sendResponse({ success: false, error: errorMsg });
                return;
            }

            if (!response.ok) {
                const errorMsg = `HTTP ${response.status}: Verification failed`;
                notifyError(tabId, requestId, errorMsg);
                sendResponse({ success: false, error: errorMsg });
                return;
            }

            notifyProgress(tabId, requestId, "Analyzing evidence...");

            // Send result back to content script
            chrome.tabs.sendMessage(tabId, {
                type: "VERIFICATION_RESULT",
                requestId,
                result: { success: true, data: result.data },
            } satisfies { type: "VERIFICATION_RESULT"; requestId: string; result: VerificationResult });

            sendResponse({ success: true, data: result.data });
        } catch (error) {
            clearTimeout(timeoutId);

            // Check if this request is still active
            if (activeRequests.get(tabId) !== requestId) {
                console.log(`[HaCha][Background] Stale request ${requestId} ignored after error`);
                return;
            }

            let errorMessage: string;
            if (error instanceof DOMException && error.name === "AbortError") {
                errorMessage = "Request timed out. Please try again.";
            } else if (error instanceof TypeError && error.message.includes("fetch")) {
                errorMessage = "Cannot connect to verification service. Is the backend running?";
            } else {
                errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            }

            console.error("[HaCha][Background] Verification error:", errorMessage);
            notifyError(tabId, requestId, errorMessage);
            sendResponse({ success: false, error: errorMessage });
        } finally {
            activeRequests.delete(tabId);
        }
}

/**
 * Send progress update to content script.
 */
function notifyProgress(tabId: number, requestId: string, stage: string): void {
    if (activeRequests.get(tabId) !== requestId) return;

    chrome.tabs.sendMessage(tabId, {
        type: "VERIFICATION_PROGRESS",
        requestId,
        stage,
    }).catch(() => {
        // Ignore errors - content script might not be ready
    });
}

/**
 * Send error to content script.
 */
function notifyError(tabId: number, requestId: string, message: string): void {
    if (activeRequests.get(tabId) !== requestId) return;

    chrome.tabs.sendMessage(tabId, {
        type: "ERROR",
        message,
    }).catch(() => {
        // Ignore errors
    });
}

/**
 * Handle status check from popup.
 */
function handleGetStatus(sendResponse: (response: { active: boolean }) => void): void {
    sendResponse({ active: activeRequests.size > 0 });
}

/**
 * Handle deactivation from popup or content script.
 */
function handleDeactivateHacha(
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success: boolean }) => void
): void {
    const tabId = sender.tab?.id;
    if (tabId) {
        activeRequests.delete(tabId);
    }
    sendResponse({ success: true });
}

// Handle tab closure to clean up
chrome.tabs.onRemoved.addListener((tabId) => {
    activeRequests.delete(tabId);
});

// Handle service worker startup
chrome.runtime.onStartup.addListener(() => {
    console.log("[HaCha][Background] Service worker started");
    activeRequests.clear();
});

export {};