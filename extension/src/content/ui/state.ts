/**
 * UI State Machine - Phase 11
 * Explicit state management to prevent invalid combinations.
 */

export type HaChaState =
    | "IDLE"
    | "SELECTING"
    | "DRAWING"
    | "CAPTURED"
    | "OCR_PROCESSING"
    | "CLAIM_CONFIRMATION"
    | "VERIFYING"
    | "RESULT"
    | "ERROR";

export interface StateContext {
    currentState: HaChaState;
    selectionRect?: {
        x: number;
        y: number;
        width: number;
        height: number;
        devicePixelRatio: number;
        viewportWidth: number;
        viewportHeight: number;
    };
    ocrText?: string;
    claimText?: string;
    requestId?: string;
    verificationResult?: any;
    errorMessage?: string;
}

type StateTransition = {
    from: HaChaState | HaChaState[];
    to: HaChaState;
    action?: (context: StateContext) => void;
};

const TRANSITIONS: StateTransition[] = [
    // Normal flow
    { from: "IDLE", to: "SELECTING" },
    { from: "SELECTING", to: "DRAWING" },
    { from: "DRAWING", to: "CAPTURED" },
    { from: "CAPTURED", to: "OCR_PROCESSING" },
    { from: "OCR_PROCESSING", to: "CLAIM_CONFIRMATION" },
    { from: "CLAIM_CONFIRMATION", to: "VERIFYING" },
    { from: "VERIFYING", to: "RESULT" },
    // Failure paths
    { from: "OCR_PROCESSING", to: "ERROR" },
    { from: "VERIFYING", to: "ERROR" },
    // Reset paths
    { from: "RESULT", to: "IDLE" },
    { from: "ERROR", to: "IDLE" },
    // Cancellation from any state
    { from: ["SELECTING", "DRAWING", "CAPTURED", "OCR_PROCESSING", "CLAIM_CONFIRMATION", "VERIFYING"], to: "IDLE" },
    // Retry from error/result
    { from: "ERROR", to: "SELECTING" },
    { from: "RESULT", to: "SELECTING" },
];

/**
 * Check if a transition is valid.
 */
export function isValidTransition(from: HaChaState, to: HaChaState): boolean {
    return TRANSITIONS.some(
        (t) =>
            (Array.isArray(t.from) ? t.from.includes(from) : t.from === from) &&
            t.to === to
    );
}

/**
 * State machine class for managing HaCha UI state.
 */
export class StateMachine {
    private context: StateContext = {
        currentState: "IDLE",
    };

    private listeners: Array<(state: HaChaState, context: StateContext) => void> = [];

    /**
     * Get current state.
     */
    getState(): HaChaState {
        return this.context.currentState;
    }

    /**
     * Get full context.
     */
    getContext(): Readonly<StateContext> {
        return this.context;
    }

    /**
     * Transition to a new state.
     * Throws if transition is invalid.
     */
    transition(to: HaChaState, updates?: Partial<StateContext>): boolean {
        const from = this.context.currentState;

        if (!isValidTransition(from, to)) {
            console.warn(`[HaCha][State] Invalid transition: ${from} -> ${to}`);
            return false;
        }

        console.log(`[HaCha][State] Transition: ${from} -> ${to}`);

        this.context = {
            ...this.context,
            currentState: to,
            ...updates,
        };

        this.notifyListeners();
        return true;
    }

    /**
     * Force transition (bypasses validation - use carefully).
     */
    forceTransition(to: HaChaState, updates?: Partial<StateContext>): void {
        console.log(`[HaCha][State] Force transition: ${this.context.currentState} -> ${to}`);
        this.context = {
            ...this.context,
            currentState: to,
            ...updates,
        };
        this.notifyListeners();
    }

    /**
     * Reset to IDLE.
     */
    reset(): void {
        this.context = {
            currentState: "IDLE",
        };
        this.notifyListeners();
    }

    /**
     * Subscribe to state changes.
     */
    subscribe(listener: (state: HaChaState, context: StateContext) => void): () => void {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx >= 0) this.listeners.splice(idx, 1);
        };
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            try {
                listener(this.context.currentState, this.context);
            } catch (err) {
                console.error("[HaCha][State] Listener error:", err);
            }
        }
    }
}

/**
 * Singleton state machine instance.
 */
export const stateMachine = new StateMachine();