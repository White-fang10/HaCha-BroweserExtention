/**
 * Verification Service - handles communication with the HaCha backend gateway.
 * Sends claims for fact-checking and processes responses.
 */

import {
    BACKEND_CONFIG,
    type VerifyResponse,
    type VerificationData,
    type Verdict,
} from "../../shared/verification-types.js";

interface VerificationResult {
    success: boolean;
    data?: VerificationData;
    error?: string;
}

/**
 * Call the backend /api/verify endpoint with a claim.
 */
export async function verifyClaim(claim: string): Promise<VerificationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT_MS);

    try {
        const response = await fetch(`${BACKEND_CONFIG.BASE_URL}${BACKEND_CONFIG.VERIFY_ENDPOINT}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ claim }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const result = (await response.json()) as VerifyResponse;

        if (!result.success) {
            return {
                success: false,
                error: result.error?.message || "Verification failed",
            };
        }

        return {
            success: true,
            data: result.data,
        };
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof DOMException && error.name === "AbortError") {
            return {
                success: false,
                error: "Request timed out. Please try again.",
            };
        }

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return {
                success: false,
                error: "Cannot connect to verification service. Is the backend running?",
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

/**
 * Get a human-readable label for a verdict.
 */
export function getVerdictLabel(verdict: Verdict): string {
    const labels: Record<Verdict, string> = {
        SUPPORTED: "Supported",
        FALSE: "False",
        MISLEADING: "Misleading",
        UNVERIFIED: "Unverified",
    };
    return labels[verdict] || verdict;
}

/**
 * Get a CSS class for a verdict for styling.
 */
export function getVerdictClass(verdict: Verdict): string {
    const classes: Record<Verdict, string> = {
        SUPPORTED: "verdict-supported",
        FALSE: "verdict-false",
        MISLEADING: "verdict-misleading",
        UNVERIFIED: "verdict-unverified",
    };
    return classes[verdict] || "";
}

/**
 * Format timestamp for display.
 */
export function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}