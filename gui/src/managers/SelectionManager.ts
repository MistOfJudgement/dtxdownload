/**
 * Manages chart selection state
 */

import { eventBus } from '../utils/EventBus.js';

export class SelectionManager {
    private selectedCharts: Set<string> = new Set();

    /**
     * Get selected chart IDs
     */
    getSelected(): Set<string> {
        return new Set(this.selectedCharts);
    }

    /**
     * Get selected chart IDs as array
     */
    getSelectedArray(): string[] {
        return Array.from(this.selectedCharts);
    }

    /**
     * Get selection count
     */
    getCount(): number {
        return this.selectedCharts.size;
    }

    /**
     * Check if chart is selected
     */
    isSelected(chartId: string): boolean {
        return this.selectedCharts.has(chartId);
    }

    /**
     * Toggle chart selection
     */
    toggle(chartId: string): void {
        if (this.selectedCharts.has(chartId)) {
            this.selectedCharts.delete(chartId);
        } else {
            this.selectedCharts.add(chartId);
        }
        this.emitChange();
    }

    /**
     * Select chart
     */
    select(chartId: string): void {
        this.selectedCharts.add(chartId);
        this.emitChange();
    }

    /**
     * Deselect chart
     */
    deselect(chartId: string): void {
        this.selectedCharts.delete(chartId);
        this.emitChange();
    }

    /**
     * Select multiple charts
     */
    selectMultiple(chartIds: string[]): void {
        chartIds.forEach(id => this.selectedCharts.add(id));
        this.emitChange();
    }

    /**
     * Select all from given list
     */
    selectAll(chartIds: string[]): void {
        chartIds.forEach(id => this.selectedCharts.add(id));
        this.emitChange();
    }

    /**
     * Clear all selections
     */
    clear(): void {
        this.selectedCharts.clear();
        this.emitChange();
    }

    /**
     * Set selection to specific charts
     */
    setSelection(chartIds: string[]): void {
        this.selectedCharts.clear();
        chartIds.forEach(id => this.selectedCharts.add(id));
        this.emitChange();
    }

    /**
     * Get selection state for a list of charts (for select all checkbox)
     */
    getSelectionState(chartIds: string[]): 'none' | 'some' | 'all' {
        const selectedCount = chartIds.filter(id => this.selectedCharts.has(id)).length;
        
        if (selectedCount === 0) {
            return 'none';
        } else if (selectedCount === chartIds.length) {
            return 'all';
        } else {
            return 'some';
        }
    }

    /**
     * Toggle all charts in a given list
     */
    toggleAll(chartIds: string[]): void {
        const state = this.getSelectionState(chartIds);
        
        if (state === 'all') {
            // Deselect all
            chartIds.forEach(id => this.selectedCharts.delete(id));
        } else {
            // Select all
            chartIds.forEach(id => this.selectedCharts.add(id));
        }
        
        this.emitChange();
    }

    /**
     * Emit selection change event
     */
    private emitChange(): void {
        eventBus.emit('selection-changed', new Set(this.selectedCharts));
    }
}
