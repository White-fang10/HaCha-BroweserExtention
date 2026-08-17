/**
 * Extension Message Types - Phase 11
 * Messages between content script and background service worker.
 */

import { VerificationData } from "./verification-types.js";
import { SelectionRect } from "./types.js";

// Content Script -> Background Worker
export type ContentToBackgroundMessage =
    | { type: "CAPTURE_TAB" }
    | { type: "VERIFY_CLAIM"; claim: string; requestId: string }
    | { type: "GET_STATUS" }
    | { type: "DEACTIVATE_HACHA" };

// Background Worker -> Content Script
export type BackgroundToContentMessage =
    | { type: "ACTIVATE_HACHA" }
    | { type: "VERIFICATION_RESULT"; requestId: string; result: VerificationResult }
    | { type: "VERIFICATION_PROGRESS"; requestId: string; stage: string }
    | { type: "ERROR"; message: string }
    | { type: "STATUS_RESPONSE"; active: boolean };

export interface VerificationResult {
    success: boolean;
    data?: VerificationData;
    error?: string;
}

// Unified message type for chrome.runtime.onMessage
export type HaChaMessage = ContentToBackgroundMessage | BackgroundToContentMessage;

// Response types
export interface ActivationResponse {
    success: boolean;
    error?: string;
}

export interface CaptureResponse {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

export interface VerifyResponse {
    success: boolean;
    data?: VerificationData;
    error?: string;
}