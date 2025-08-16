/**
 * Simple event bus for communication between modules
 */

export class EventBus {
    private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

    on(event: string, callback: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: string, callback: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event)!;
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event: string, ...args: any[]): void {
        if (!this.listeners.has(event)) return;
        
        this.listeners.get(event)!.forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    clear(): void {
        this.listeners.clear();
    }
}

// Global event bus instance
export const eventBus = new EventBus();
