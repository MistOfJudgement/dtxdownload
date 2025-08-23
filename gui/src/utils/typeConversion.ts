/**
 * Minimal utilities for converting API responses to GUI types
 * Most conversions are now eliminated through type alignment
 */

import { Chart } from '../types/index';
import { ChartResponse } from '@shared/models';

/**
 * Convert ChartResponse from API to Chart for GUI
 * Only handles date string to Date object conversion
 */
export function convertChartResponseToChart(chartResponse: ChartResponse): Chart {
  return {
    ...chartResponse,
    // Convert ISO date strings to Date objects for GUI
    createdAt: chartResponse.createdAt ? new Date(chartResponse.createdAt) : new Date(),
    updatedAt: chartResponse.updatedAt ? new Date(chartResponse.updatedAt) : new Date(),
    // Ensure imageUrl fallback
    imageUrl: chartResponse.imageUrl || chartResponse.previewImageUrl
  };
}

/**
 * Convert array of ChartResponse to array of Chart
 */
export function convertChartResponsesToCharts(chartResponses: ChartResponse[]): Chart[] {
  return chartResponses.map(convertChartResponseToChart);
}
