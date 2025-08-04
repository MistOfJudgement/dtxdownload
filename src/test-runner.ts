import { download, convertLinkToObj, unzip, songFolder } from './download/dl-handler';
import { getAllSongs } from './database/dtx-db';
import { IDtxChart } from './types';

function parseCommandLineArgs(): number[] {
  if (process.argv.length === 3) {
    try {
      return JSON.parse(process.argv[2]) as number[];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Invalid JSON format for song indices');
      process.exit(1);
    }
  }
  return [1171]; // Default song index
}

export async function downloadSongs(songIndices: number[]): Promise<void> {
  const allSongs = getAllSongs();
  const songsToDownload = songIndices
    .map(index => allSongs[index])
    .filter((song): song is IDtxChart => song !== undefined);

  // eslint-disable-next-line no-console
  console.log(`Starting download of ${songsToDownload.length} songs...`);

  for (let i = 0; i < songsToDownload.length; i++) {
    const dtx = songsToDownload[i];
    try {
      // eslint-disable-next-line no-console
      console.log(`[${i + 1}/${songsToDownload.length}] Downloading: ${dtx.title}`);
      
      const linkObj = convertLinkToObj(dtx.dlURL);
      const fileName = `${dtx.title.replace(/[/\\?%*:|"<>]/g, '-')}.zip`;
      const downloadPath = `./dtx/${fileName}`;
      
      await download(linkObj, downloadPath);
      // eslint-disable-next-line no-console
      console.log(`✓ Downloaded ${dtx.title}`);
      
      await unzip(downloadPath, songFolder);
      // eslint-disable-next-line no-console
      console.log(`✓ Extracted ${dtx.title}`);
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`✗ Failed to download ${dtx.title}:`);
      console.error(error);
    }
  }
  
  // eslint-disable-next-line no-console
  console.log('Download process completed!');
}

export async function main(): Promise<void> {
  const songIndices = parseCommandLineArgs();
  await downloadSongs(songIndices);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
