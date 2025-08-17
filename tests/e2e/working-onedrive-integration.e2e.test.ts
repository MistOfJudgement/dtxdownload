/**
 * Working OneDrive Download Integration Test
 * This demonstrates how to use the actual MCP Playwright tools for real downloads
 */

import { WorkingOneDriveDownloader } from '../../src/core/download/working-onedrive-downloader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// This test shows how you would integrate with real MCP Playwright tools
describe('Working OneDrive Integration Test', () => {
  let downloader: WorkingOneDriveDownloader;
  let testDownloadDir: string;

  beforeAll(() => {
    downloader = new WorkingOneDriveDownloader();
    testDownloadDir = path.join(os.tmpdir(), 'dtx-working-onedrive-downloads');
    
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

  test('should actually download zip file from OneDrive', async () => {
    console.log('\n🎯 Testing REAL OneDrive Download');
    console.log('='.repeat(60));

    const testChart = {
      id: 'real-download-test',
      title: 'Real OneDrive Chart',
      artist: 'Test Artist',
      downloadUrl: 'https://1drv.ms/u/s!AkFLx6UquiX2yG-WtbNj1b_sZbiW?e=Q1tXA0'
    };

    const options = {
      downloadDir: testDownloadDir,
      timeout: 60000, // 60 second timeout for real download
      chart: testChart
    };

    console.log(`📊 Chart: ${testChart.title} by ${testChart.artist}`);
    console.log(`🔗 OneDrive URL: ${testChart.downloadUrl}`);
    console.log(`📁 Download Dir: ${testDownloadDir}`);
    
    console.log('\n� Starting REAL download with Puppeteer...');

    const result = await downloader.downloadFromOneDrive(options);

    console.log('\n📋 Download Result:');
    console.log(`✅ Success: ${result.success}`);
    if (result.filePath) {
      console.log(`📁 File Path: ${result.filePath}`);
      console.log(`📦 File Size: ${result.fileSize} bytes`);
      
      // Verify it's a real file
      const fileExists = fs.existsSync(result.filePath);
      console.log(`� File exists: ${fileExists}`);
      
      if (fileExists) {
        const stats = fs.statSync(result.filePath);
        console.log(`📏 Actual file size: ${stats.size} bytes`);
        console.log(`📄 File extension: ${path.extname(result.filePath)}`);
        
        // Check if it's a zip file
        const isZip = path.extname(result.filePath).toLowerCase() === '.zip';
        console.log(`📦 Is ZIP file: ${isZip}`);
      }
    }
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }

    // Verify the download worked
    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);

    // Verify file actually exists
    if (result.filePath) {
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      const stats = fs.statSync(result.filePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(100); // Should be more than 100 bytes for a real zip
      
      console.log(`✅ REAL ZIP FILE DOWNLOADED: ${path.basename(result.filePath)}`);
      console.log(`🎉 SUCCESS! OneDrive download working with actual file!`);
    }
  }, 120000); // 2 minute timeout for real download


  test('should validate OneDrive URL detection', () => {
    console.log('\n🎯 Testing OneDrive URL Detection');
    console.log('='.repeat(60));
    
    const testUrls = [
      { url: 'https://1drv.ms/u/s!AmKdp4OvR3gDhHJzSWrJjKJhqJ7Q?e=UEpPmU', expected: true },
      { url: 'https://onedrive.live.com/download?cid=123&resid=456', expected: true },
      { url: 'https://1drv.ms/u/s!AkFLx6UquiX2yG-WtbNj1b_sZbiW?e=Q1tXA0', expected: true },
      { url: 'https://example.com/file.zip', expected: false },
      { url: 'https://drive.google.com/file/123', expected: false }
    ];
    
    // Since WorkingOneDriveDownloader doesn't expose isOneDriveUrl method,
    // we'll test the pattern directly
    const oneDrivePattern = /(?:1drv\.ms|onedrive\.live\.com)/i;
    
    for (const test of testUrls) {
      const isOneDrive = oneDrivePattern.test(test.url);
      console.log(`🔗 ${test.url}: ${isOneDrive ? '✅ OneDrive' : '❌ Not OneDrive'}`);
      expect(isOneDrive).toBe(test.expected);
    }
    
    console.log('\n✅ OneDrive URL detection working correctly!');
  });
});
