import { extractIdFromUrl, buildDownloadUrl, assert } from '../utils/google-drive';

describe('Google Drive Utils', () => {
  test('should extract ID from Google Drive URL', () => {
    const url = 'https://drive.google.com/file/d/1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw/view?usp=sharing';
    const expectedId = '1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw';
    const actualId = extractIdFromUrl(url);
    expect(actualId).toBe(expectedId);
  });

  test('should build correct download URL', () => {
    const id = '1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw';
    const expectedUrl = 'https://drive.google.com/uc?export=download&id=1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw';
    const actualUrl = buildDownloadUrl(id);
    expect(actualUrl).toBe(expectedUrl);
  });

  test('should throw error when building URL with empty ID', () => {
    expect(() => buildDownloadUrl('')).toThrow('No ID provided');
  });

  test('assert function should work correctly', () => {
    expect(() => assert(true, 'Should not throw')).not.toThrow();
    expect(() => assert(false, 'Should throw')).toThrow('Should throw');
  });
});
