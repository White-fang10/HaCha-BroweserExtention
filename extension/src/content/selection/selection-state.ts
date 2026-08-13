import { SelectionRect } from "../../shared/types.js";

export type SelectionModeState = "INACTIVE" | "SELECTING" | "DRAWING" | "SELECTED" | "CAPTURING" | "PREVIEW";

export class SelectionState {
    private state: SelectionModeState = "INACTIVE";
    private startX: number = 0;
    private startY: number = 0;
    private currentX: number = 0;
    private currentY: number = 0;
    
    // Minimum selection size in pixels
    private readonly MIN_WIDTH = 20;
    private readonly MIN_HEIGHT = 20;

    public getState(): SelectionModeState {
        return this.state;
    }

    public setState(newState: SelectionModeState) {
        this.state = newState;
    }

    public startDrawing(x: number, y: number) {
        this.state = "DRAWING";
        this.startX = x;
        this.startY = y;
        this.currentX = x;
        this.currentY = y;
    }

    public updateDrawing(x: number, y: number) {
        if (this.state !== "DRAWING") return;
        this.currentX = x;
        this.currentY = y;
    }

    public finishDrawing(): boolean {
        if (this.state !== "DRAWING") return false;
        
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        if (width < this.MIN_WIDTH || height < this.MIN_HEIGHT) {
            // Selection too small, cancel it
            this.state = "SELECTING";
            return false;
        }

        this.state = "SELECTED";
        return true;
    }

    public getSelectionRect(): SelectionRect {
        return {
            x: Math.min(this.startX, this.currentX),
            y: Math.min(this.startY, this.currentY),
            width: Math.abs(this.currentX - this.startX),
            height: Math.abs(this.currentY - this.startY),
            devicePixelRatio: window.devicePixelRatio,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };
    }
}
