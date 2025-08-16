/**
 * DOM utility functions
 */

export class DOMUtils {
    /**
     * Get element by ID with type safety
     */
    static getElementById<T extends HTMLElement = HTMLElement>(id: string): T | null {
        return document.getElementById(id) as T | null;
    }

    /**
     * Get element by ID and throw if not found
     */
    static getRequiredElement<T extends HTMLElement = HTMLElement>(id: string): T {
        const element = document.getElementById(id) as T | null;
        if (!element) {
            throw new Error(`Required element not found: ${id}`);
        }
        return element;
    }

    /**
     * Show/hide elements using CSS classes
     */
    static toggleElement(elementId: string, show: boolean): void {
        const element = this.getElementById(elementId);
        if (element) {
            if (show) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }

    /**
     * Show an element and hide others
     */
    static showOnly(showElementId: string, hideElementIds: string[]): void {
        this.toggleElement(showElementId, true);
        hideElementIds.forEach(id => this.toggleElement(id, false));
    }

    /**
     * Add event listener with proper typing
     */
    static addEventListener<K extends keyof HTMLElementEventMap>(
        elementId: string,
        type: K,
        listener: (event: HTMLElementEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ): void {
        const element = this.getElementById(elementId);
        if (element) {
            element.addEventListener(type, listener, options);
        }
    }

    /**
     * Set element content safely
     */
    static setTextContent(elementId: string, content: string | number): void {
        const element = this.getElementById(elementId);
        if (element) {
            element.textContent = content.toString();
        }
    }

    /**
     * Set element HTML safely
     */
    static setInnerHTML(elementId: string, html: string): void {
        const element = this.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
        }
    }

    /**
     * Get form value safely
     */
    static getValue(elementId: string): string {
        const element = this.getElementById<HTMLInputElement | HTMLSelectElement>(elementId);
        return element?.value || '';
    }

    /**
     * Set form value safely
     */
    static setValue(elementId: string, value: string): void {
        const element = this.getElementById<HTMLInputElement | HTMLSelectElement>(elementId);
        if (element) {
            element.value = value;
        }
    }

    /**
     * Get checkbox state safely
     */
    static getChecked(elementId: string): boolean {
        const element = this.getElementById<HTMLInputElement>(elementId);
        return element?.checked || false;
    }

    /**
     * Set checkbox state safely
     */
    static setChecked(elementId: string, checked: boolean): void {
        const element = this.getElementById<HTMLInputElement>(elementId);
        if (element) {
            element.checked = checked;
        }
    }

    /**
     * Set element disabled state
     */
    static setDisabled(elementId: string, disabled: boolean): void {
        const element = this.getElementById<HTMLButtonElement | HTMLInputElement>(elementId);
        if (element) {
            element.disabled = disabled;
        }
    }

    /**
     * Create element with attributes
     */
    static createElement<K extends keyof HTMLElementTagNameMap>(
        tagName: K,
        attributes?: Partial<HTMLElementTagNameMap[K]>,
        textContent?: string
    ): HTMLElementTagNameMap[K] {
        const element = document.createElement(tagName);
        
        if (attributes) {
            Object.assign(element, attributes);
        }
        
        if (textContent) {
            element.textContent = textContent;
        }
        
        return element;
    }
}
