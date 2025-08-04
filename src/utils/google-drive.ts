import { get } from '../utils/http';

export function extractIdFromUrl(url: string): string | null {
  const regex = /[-\w]{25,}/;
  const match = url.match(regex);
  return match ? match[0] : null;
}

export function buildDownloadUrl(id: string): string {
  if (!id) {
    throw new Error('No ID provided');
  }
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export async function getDataFromPage(url: string): Promise<string> {
  try {
    const html = await get(url);
    if (!html) {
      throw new Error('Failed to fetch HTML');
    }
    return html;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching data from page:', error);
    throw error;
  }
}

export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export async function testGoogleDriveDownload(): Promise<void> {
  const sampleUrl = 'https://drive.google.com/file/d/1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw/view?usp=sharing';
  const id = extractIdFromUrl(sampleUrl);
  assert(id === '1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw', 'Failed to extract correct ID');
  
  const downloadUrl = buildDownloadUrl(id);
  const expectedUrl = 'https://drive.google.com/uc?export=download&id=1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw';
  assert(downloadUrl === expectedUrl, 'Failed to build correct download URL');
  
  // eslint-disable-next-line no-console
  console.log('Google Drive test passed!');
  
  try {
    await getDataFromPage(downloadUrl);
    // eslint-disable-next-line no-console
    console.log('Page data retrieved successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to retrieve page data:', error);
  }
}
