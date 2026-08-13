export type HaChaState = "IDLE" | "ACTIVATING" | "ACTIVE" | "ERROR";

export interface ActivationResponse {
    success: boolean;
    error?: string;
}

export interface SelectionRect {
    x: number;
    y: number;
    width: number;
    height: number;
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
}

export interface OCRResult {
    text: string;
    confidence: number;
    language: string;
    processingTimeMs: number;
    characterCount: number;
    wordCount: number;
    source: "local-tesseract";
}
