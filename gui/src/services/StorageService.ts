/**
 * Local storage service for persisting data
 */

import { Chart } from '../types/index.js';

export class StorageService {
    private static readonly CHARTS_KEY = 'dtx_charts';
    private static readonly DOWNLOAD_DIR_KEY = 'dtx_last_download_dir';
    private static readonly SETTINGS_KEY = 'dtx_settings';

    /**
     * Save charts to localStorage
     */
    static saveCharts(charts: Chart[]): void {
        try {
            localStorage.setItem(this.CHARTS_KEY, JSON.stringify(charts));
        } catch (error) {
            console.error('Failed to save charts to localStorage:', error);
        }
    }

    /**
     * Load charts from localStorage
     */
    static loadCharts(): Chart[] {
        try {
            const saved = localStorage.getItem(this.CHARTS_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load charts from localStorage:', error);
        }
        return [];
    }

    /**
     * Clear all charts from localStorage
     */
    static clearCharts(): void {
        try {
            localStorage.removeItem(this.CHARTS_KEY);
        } catch (error) {
            console.error('Failed to clear charts from localStorage:', error);
        }
    }

    /**
     * Save download directory
     */
    static saveDownloadDirectory(path: string): void {
        try {
            localStorage.setItem(this.DOWNLOAD_DIR_KEY, path);
        } catch (error) {
            console.error('Failed to save download directory:', error);
        }
    }

    /**
     * Load download directory
     */
    static loadDownloadDirectory(): string {
        try {
            return localStorage.getItem(this.DOWNLOAD_DIR_KEY) || './downloads';
        } catch (error) {
            console.error('Failed to load download directory:', error);
            return './downloads';
        }
    }

    /**
     * Save application settings
     */
    static saveSettings(settings: Record<string, any>): void {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Load application settings
     */
    static loadSettings(): Record<string, any> {
        try {
            const saved = localStorage.getItem(this.SETTINGS_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        return {};
    }

    /**
     * Clear all data
     */
    static clearAll(): void {
        try {
            localStorage.removeItem(this.CHARTS_KEY);
            localStorage.removeItem(this.DOWNLOAD_DIR_KEY);
            localStorage.removeItem(this.SETTINGS_KEY);
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }
    }
}
