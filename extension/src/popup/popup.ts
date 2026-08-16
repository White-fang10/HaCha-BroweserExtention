import { HaChaState, ActivationResponse } from "../shared/types.js";
import { HaChaMessage } from "../shared/messages.js";

console.log("[HaCha][Popup] Initialized");

const BACKEND_URL = "http://localhost:3000/api/health";

document.addEventListener("DOMContentLoaded", () => {
    const activateBtn = document.getElementById("activate-btn") as HTMLButtonElement;
    const errorDiv = document.getElementById("error-message") as HTMLDivElement;
    const backendStatus = document.getElementById("backend-status") as HTMLSpanElement;

    let currentState: HaChaState = "IDLE";

    function updateState(newState: HaChaState, errorMessage?: string) {
        currentState = newState;

        switch (newState) {
            case "IDLE":
                activateBtn.textContent = "Activate HaCha";
                activateBtn.disabled = false;
                errorDiv.classList.add("hidden");
                break;
            case "ACTIVATING":
                activateBtn.textContent = "Activating...";
                activateBtn.disabled = true;
                errorDiv.classList.add("hidden");
                break;
            case "ACTIVE":
                activateBtn.textContent = "HaCha Active";
                activateBtn.disabled = false; // Allow re-activation or let them close popup
                errorDiv.classList.add("hidden");
                break;
            case "ERROR":
                activateBtn.textContent = "Try again";
                activateBtn.disabled = false;
                errorDiv.textContent = errorMessage || "Activation failed";
                errorDiv.classList.remove("hidden");
                break;
        }
    }

    function updateBackendStatus(status: "connected" | "disconnected" | "checking", message?: string) {
        backendStatus.textContent = message || (status === "connected" ? "Connected" : status === "disconnected" ? "Disconnected" : "Checking...");
        backendStatus.className = "status-value " + status;
    }

    async function checkBackend() {
        updateBackendStatus("checking");
        try {
            const response = await fetch(BACKEND_URL, { method: "GET" });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.status === "healthy") {
                    updateBackendStatus("connected");
                } else {
                    updateBackendStatus("disconnected", "Unhealthy");
                }
            } else {
                updateBackendStatus("disconnected", `Error ${response.status}`);
            }
        } catch (err) {
            updateBackendStatus("disconnected", "Offline");
        }
    }

    // Check backend on popup open
    checkBackend();

    activateBtn.addEventListener("click", () => {
        updateState("ACTIVATING");
        console.log("[HaCha][Popup] Activation requested");

        const message: HaChaMessage = { type: "ACTIVATE_HACHA" };
        chrome.runtime.sendMessage(message, (response: ActivationResponse) => {
            if (chrome.runtime.lastError) {
                console.error("[HaCha][Popup] Error communicating with background:", chrome.runtime.lastError.message);
                updateState("ERROR", "Internal extension error.");
                return;
            }

            if (response && response.success) {
                updateState("ACTIVE");
            } else {
                updateState("ERROR", response?.error || "Activation failed");
            }
        });
    });
});