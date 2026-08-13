export type HaChaState = "IDLE" | "ACTIVATING" | "ACTIVE" | "ERROR";

export interface ActivationResponse {
    success: boolean;
    error?: string;
}
