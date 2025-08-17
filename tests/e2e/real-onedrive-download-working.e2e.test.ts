/**
 * Real OneDrive Download End-to-End Test
 * This test demonstrates actual file downloads from OneDrive
 */

import { RealOneDriveDownloader } from '../../src/core/download/real-onedrive-downloader';
import type { OneDriveDownloadResult } from '../../src/core/download/real-onedrive-downloader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Real OneDrive Download E2E Tests', () => {
  let downloader: RealOneDriveDownloader;
  let testDownloadDir: string;

  beforeAll(() => {
    downloader = new RealOneDriveDownloader();
    testDownloadDir = path.join(os.tmpdir(), 'dtx-onedrive-test-downloads');
    
    // Clean and create test directory
    if (fs.existsSync(testDownloadDir)) {
      fs.rmSync(testDownloadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDownloadDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDownloadDir)) {
      fs.rmSync(testDownloadDir, { recursive: true, force: true });
    }
  });

  test('should download OneDrive file with real browser automation', async () => {
    console.log('\n🎯 Testing Real OneDrive Download');
    console.log('='.repeat(50));

    const testChart = {
      id: 'onedrive-test-1',
      title: 'Baby Dance',
      artist: 'Test Artist',
      downloadUrl: 'https://1drv.ms/u/s!AmKdp4OvR3gDhHJzSWrJjKJhqJ7Q?e=UEpPmU'
    };

    const options = {
      downloadDir: testDownloadDir,
      timeout: 30000,
      chart: testChart
    };

    console.log(`📊 Chart: ${testChart.title} by ${testChart.artist}`);
    console.log(`🔗 OneDrive URL: ${testChart.downloadUrl}`);
    console.log(`📁 Download Dir: ${testDownloadDir}`);

    const result = await downloader.downloadFromOneDrive(options);

    console.log('\n📋 Download Result:');
    console.log(`✅ Success: ${result.success}`);
    if (result.filePath) {
      console.log(`📁 File Path: ${result.filePath}`);
      console.log(`📦 File Size: ${result.fileSize} bytes`);
    }
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }

    // Verify the download
    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);

    // Verify file exists
    if (result.filePath) {
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      const stats = fs.statSync(result.filePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
      
      console.log(`✅ File verified: ${path.basename(result.filePath)} (${stats.size} bytes)`);
    }
  }, 60000); // 60 second timeout for real downloads

  test('should handle multiple OneDrive downloads', async () => {
    console.log('\n🎯 Testing Multiple OneDrive Downloads');
    console.log('='.repeat(50));

    const testCharts = [
      {
        id: 'onedrive-test-2',
        title: 'Chart A',
        artist: 'Artist A',
        downloadUrl: 'https://1drv.ms/u/s!AmKdp4OvR3gDhHJzSWrJjKJhqJ7Q?e=UEpPmU'
      },
      {
        id: 'onedrive-test-3',
        title: 'Chart B',
        artist: 'Artist B',
        downloadUrl: 'https://1drv.ms/u/s!AmKdp4OvR3gDhHJzSWrJjKJhqJ7Q?e=UEpPmU'
      }
    ];

    const results: OneDriveDownloadResult[] = [];

    for (const chart of testCharts) {
      console.log(`\n📊 Downloading: ${chart.title}`);
      
      const options = {
        downloadDir: testDownloadDir,
        timeout: 30000,
        chart
      };

      const result = await downloader.downloadFromOneDrive(options);
      results.push(result);

      console.log(`📋 Result: ${result.success ? '✅ Success' : '❌ Failed'}`);
      if (result.filePath) {
        console.log(`📁 File: ${path.basename(result.filePath)}`);
      }
    }

    // Verify all downloads succeeded
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      
      if (result.filePath) {
        expect(fs.existsSync(result.filePath)).toBe(true);
      }
    }

    console.log(`\n🎉 Successfully downloaded ${results.length} files!`);
  }, 120000); // 2 minute timeout for multiple downloads

  test('should organize downloaded files properly', async () => {
    console.log('\n🎯 Testing File Organization');
    console.log('='.repeat(50));

    const testChart = {
      id: 'onedrive-test-4',
      title: 'Organized Chart Test',
      artist: 'Test Artist',
      downloadUrl: 'https://1drv.ms/u/s!AmKdp4OvR3gDhHJzSWrJjKJhqJ7Q?e=UEpPmU'
    };

    const organizedDir = path.join(testDownloadDir, 'organized');
    
    const options = {
      downloadDir: organizedDir,
      timeout: 30000,
      chart: testChart
    };

    const result = await downloader.downloadFromOneDrive(options);

    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();

    if (result.filePath) {
      // Verify file is in the correct directory
      expect(result.filePath.startsWith(organizedDir)).toBe(true);
      
      // Verify filename format
      const expectedFilename = `${testChart.title}.zip`;
      expect(path.basename(result.filePath)).toBe(expectedFilename);
      
      console.log(`✅ File organized correctly: ${result.filePath}`);
    }
  }, 60000);

  test('should handle errors gracefully', async () => {
    console.log('\n🎯 Testing Error Handling');
    console.log('='.repeat(50));

    const invalidChart = {
      id: 'invalid-test',
      title: 'Invalid Chart',
      artist: 'Test Artist',
      downloadUrl: 'https://invalid-onedrive-url.com/test'
    };

    const options = {
      downloadDir: testDownloadDir,
      timeout: 10000,
      chart: invalidChart
    };

    const result = await downloader.downloadFromOneDrive(options);

    // Should handle error gracefully
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('OneDrive download failed');

    console.log(`✅ Error handled gracefully: ${result.error}`);
  }, 30000);

  test('should provide detailed progress logging', async () => {
    console.log('\n🎯 Testing Progress Logging');
    console.log('='.repeat(50));

    const testChart = {
      id: 'logging-test',
      title: 'Progress Test Chart',
      artist: 'Test Artist',
      downloadUrl: 'https://1drv.ms/u/s!AmKdp4OvR3gDhHJzSWrJjKJhqJ7Q?e=UEpPmU'
    };

    const options = {
      downloadDir: testDownloadDir,
      timeout: 30000,
      chart: testChart
    };

    // Capture console output
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      consoleLogs.push(message);
      originalLog(...args);
    };

    const result = await downloader.downloadFromOneDrive(options);

    // Restore console
    console.log = originalLog;

    // Verify detailed logging occurred
    expect(consoleLogs.length).toBeGreaterThan(5);
    
    const hasStartMessage = consoleLogs.some(log => log.includes('Starting real OneDrive download'));
    const hasNavigationMessage = consoleLogs.some(log => log.includes('Navigating to OneDrive'));
    const hasCompletionMessage = consoleLogs.some(log => log.includes('download completed') || log.includes('download failed'));
    
    expect(hasStartMessage).toBe(true);
    expect(hasNavigationMessage).toBe(true);
    expect(hasCompletionMessage).toBe(true);

    console.log(`✅ Detailed logging verified: ${consoleLogs.length} log messages`);
  }, 60000);
});
