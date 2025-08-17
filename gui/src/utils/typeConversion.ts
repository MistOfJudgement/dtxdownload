/**
 * Utilities for converting API responses to GUI types
 */

import { Chart } from '../types/index';
import { ChartResponse } from '@shared/models';

/**
 * Convert ChartResponse from API to Chart for GUI
 */
export function convertChartResponseToChart(chartResponse: ChartResponse): Chart {
  return {
    id: chartResponse.id,
    title: chartResponse.title,
    artist: chartResponse.artist,
    bpm: chartResponse.bpm,
    difficulties: chartResponse.difficulties,
    source: chartResponse.source,
    downloadUrl: chartResponse.downloadUrl,
    previewImageUrl: chartResponse.previewImageUrl || chartResponse.imageUrl,
    imageUrl: chartResponse.imageUrl || chartResponse.previewImageUrl,
    createdAt: chartResponse.createdAt ? new Date(chartResponse.createdAt) : new Date(),
    updatedAt: chartResponse.updatedAt ? new Date(chartResponse.updatedAt) : new Date(),
    tags: chartResponse.tags
  };
}

/**
 * Convert array of ChartResponse to array of Chart
 */
export function convertChartResponsesToCharts(chartResponses: ChartResponse[]): Chart[] {
  return chartResponses.map(convertChartResponseToChart);
}
