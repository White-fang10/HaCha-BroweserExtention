/**
 * Positioning Service - Phase 11
 * Calculates optimal placement for contextual overlay near selection
 * with viewport collision detection and clamping.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Viewport {
    width: number;
    height: number;
}

export interface PositionResult {
    x: number;
    y: number;
    position: "right" | "left" | "below" | "above";
}

export interface PositionOptions {
    cardWidth: number;
    cardHeight: number;
    selectionRect: Rect;
    viewport: Viewport;
    gap?: number;
    margin?: number;
}

/**
 * Calculate the optimal position for the result card near the selection.
 * Preferred order: right, left, below, above.
 * Returns the first position that fits within the viewport with margins.
 */
export function calculatePosition(options: PositionOptions): PositionResult {
    const {
        cardWidth,
        cardHeight,
        selectionRect,
        viewport,
        gap = 12,
        margin = 12,
    } = options;

    const { x, y, width, height } = selectionRect;
    const { width: vpWidth, height: vpHeight } = viewport;

    // Candidate positions in preferred order
    const candidates: Array<{ position: PositionResult["position"]; x: number; y: number }> = [
        // Right of selection
        {
            position: "right",
            x: x + width + gap,
            y: y,
        },
        // Left of selection
        {
            position: "left",
            x: x - cardWidth - gap,
            y: y,
        },
        // Below selection
        {
            position: "below",
            x: x,
            y: y + height + gap,
        },
        // Above selection
        {
            position: "above",
            x: x,
            y: y - cardHeight - gap,
        },
    ];

    // Check each candidate and return the first that fits
    for (const candidate of candidates) {
        if (fitsInViewport(candidate.x, candidate.y, cardWidth, cardHeight, vpWidth, vpHeight, margin)) {
            return candidate;
        }
    }

    // None fit perfectly - use clamped position (prefer right, then below)
    const clampedX = clamp(candidates[0].x, margin, vpWidth - cardWidth - margin);
    const clampedY = clamp(candidates[0].y, margin, vpHeight - cardHeight - margin);

    return {
        x: clampedX,
        y: clampedY,
        position: candidates[0].position,
    };
}

/**
 * Check if a rectangle fits within the viewport with margins.
 */
function fitsInViewport(
    x: number,
    y: number,
    width: number,
    height: number,
    vpWidth: number,
    vpHeight: number,
    margin: number
): boolean {
    return (
        x >= margin &&
        y >= margin &&
        x + width <= vpWidth - margin &&
        y + height <= vpHeight - margin
    );
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Get viewport dimensions.
 */
export function getViewport(): Viewport {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
}

/**
 * Get selection rect in viewport coordinates.
 */
export function getSelectionViewportRect(rect: Rect): Rect {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    };
}

/**
 * Debounce function for scroll/resize handlers.
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Throttle function for scroll/resize handlers.
 */
export function throttle<T extends (...args: unknown[]) => void>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}