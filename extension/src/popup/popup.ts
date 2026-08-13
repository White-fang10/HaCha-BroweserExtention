import { HaChaState, ActivationResponse } from "../shared/types.js";
import { HaChaMessage } from "../shared/messages.js";

console.log("[HaCha][Popup] Initialized");

document.addEventListener("DOMContentLoaded", () => {
    const activateBtn = document.getElementById("activate-btn") as HTMLButtonElement;
    const errorDiv = document.getElementById("error-message") as HTMLDivElement;

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
