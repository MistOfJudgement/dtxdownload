import { main as scrapeMain } from './scraper/approved-dtx';

export async function main(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('Starting DTX Download Tool...');
    await scrapeMain();
    // eslint-disable-next-line no-console
    console.log('Scraping completed successfully!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
