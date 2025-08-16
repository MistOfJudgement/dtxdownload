/**
 * Simple     off(event: string, listener?: EventListener): void {
        if (!this.listeners.has(event)) return;
        
        if (!listener) {
            // Remove all listeners for this event
            this.listeners.delete(event);
            return;
        }
        
        const callbacks = this.listeners.get(event)!;
        const index = callbacks.indexOf(listener);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    } for communication between modules
 */

export class EventBus {
    private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

    on(event: string, callback: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: string, callback?: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) return;
        
        if (callback) {
            const callbacks = this.listeners.get(event)!;
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
            
            // Remove the event entirely if no listeners remain
            if (callbacks.length === 0) {
                this.listeners.delete(event);
            }
        } else {
            // Remove all listeners for this event
            this.listeners.delete(event);
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
