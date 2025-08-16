/**
 * Manages UI state like pagination, view mode, loading states
 */

import { UIState, ViewMode, SortOrder } from '../types/index.js';
import { eventBus } from '../utils/EventBus.js';

export class UIStateManager {
    private state: UIState = {
        currentPage: 1,
        chartsPerPage: 20,
        viewMode: 'grid',
        sortBy: 'title',
        sortOrder: 'asc',
        searchQuery: '',
        isLoading: false
    };

    /**
     * Get current UI state
     */
    getState(): UIState {
        return { ...this.state };
    }

    /**
     * Get current page
     */
    getCurrentPage(): number {
        return this.state.currentPage;
    }

    /**
     * Set current page
     */
    setCurrentPage(page: number): void {
        this.state.currentPage = Math.max(1, page);
        this.emitChange();
    }

    /**
     * Go to next page
     */
    nextPage(totalPages: number): void {
        if (this.state.currentPage < totalPages) {
            this.state.currentPage++;
            this.emitChange();
        }
    }

    /**
     * Go to previous page
     */
    previousPage(): void {
        if (this.state.currentPage > 1) {
            this.state.currentPage--;
            this.emitChange();
        }
    }

    /**
     * Get charts per page
     */
    getChartsPerPage(): number {
        return this.state.chartsPerPage;
    }

    /**
     * Set charts per page
     */
    setChartsPerPage(count: number): void {
        this.state.chartsPerPage = Math.max(1, count);
        this.state.currentPage = 1; // Reset to first page
        this.emitChange();
    }

    /**
     * Get view mode
     */
    getViewMode(): ViewMode {
        return this.state.viewMode;
    }

    /**
     * Set view mode
     */
    setViewMode(mode: ViewMode): void {
        this.state.viewMode = mode;
        this.emitChange();
    }

    /**
     * Get sort criteria
     */
    getSortBy(): string {
        return this.state.sortBy;
    }

    /**
     * Set sort criteria
     */
    setSortBy(sortBy: string): void {
        this.state.sortBy = sortBy;
        this.emitChange();
    }

    /**
     * Get sort order
     */
    getSortOrder(): SortOrder {
        return this.state.sortOrder;
    }

    /**
     * Set sort order
     */
    setSortOrder(order: SortOrder): void {
        this.state.sortOrder = order;
        this.emitChange();
    }

    /**
     * Toggle sort order
     */
    toggleSortOrder(): void {
        this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        this.emitChange();
    }

    /**
     * Get search query
     */
    getSearchQuery(): string {
        return this.state.searchQuery;
    }

    /**
     * Set search query
     */
    setSearchQuery(query: string): void {
        this.state.searchQuery = query;
        this.state.currentPage = 1; // Reset to first page when searching
        this.emitChange();
    }

    /**
     * Get loading state
     */
    isLoading(): boolean {
        return this.state.isLoading;
    }

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
        this.state.isLoading = loading;
        this.emitChange();
    }

    /**
     * Calculate pagination info
     */
    getPaginationInfo(totalItems: number): {
        totalPages: number;
        startIndex: number;
        endIndex: number;
        hasNext: boolean;
        hasPrev: boolean;
    } {
        const totalPages = Math.ceil(totalItems / this.state.chartsPerPage);
        const startIndex = (this.state.currentPage - 1) * this.state.chartsPerPage;
        const endIndex = Math.min(startIndex + this.state.chartsPerPage, totalItems);

        return {
            totalPages,
            startIndex,
            endIndex,
            hasNext: this.state.currentPage < totalPages,
            hasPrev: this.state.currentPage > 1
        };
    }

    /**
     * Get paginated items
     */
    getPaginatedItems<T>(items: T[]): T[] {
        const { startIndex, endIndex } = this.getPaginationInfo(items.length);
        return items.slice(startIndex, endIndex);
    }

    /**
     * Reset pagination
     */
    resetPagination(): void {
        this.state.currentPage = 1;
        this.emitChange();
    }

    /**
     * Emit state change event
     */
    private emitChange(): void {
        eventBus.emit('ui-state-changed', { ...this.state });
    }
}
