const { ChartDatabase } = require('./src/core/database');

async function searchCharts() {
  const db = new ChartDatabase();
  
  console.log('Searching for Darling Dance chart...');
  
  try {
    // Search for charts with Darling
    const darlingCharts = await db.queryCharts({ search: 'Darling' });
    console.log(`Found ${darlingCharts.length} charts with "Darling":`);
    darlingCharts.forEach(chart => {
      console.log(`- #${chart.id}: "${chart.title}" by ${chart.artist}`);
      console.log(`  Download URL: ${chart.downloadUrl || 'NOT SET'}`);
    });
    
    // Search for Zutomayo
    const zutoCharts = await db.queryCharts({ search: 'zutomayo' });
    console.log(`\nFound ${zutoCharts.length} charts with "zutomayo":`);
    zutoCharts.forEach(chart => {
      console.log(`- #${chart.id}: "${chart.title}" by ${chart.artist}`);
      console.log(`  Download URL: ${chart.downloadUrl || 'NOT SET'}`);
    });
    
    // Get total count
    const totalCount = await db.getTotalChartCount();
    console.log(`\nTotal charts in database: ${totalCount}`);
    
    // Get recent charts to see what we have
    const recentCharts = await db.queryCharts({ limit: 5 });
    console.log(`\nRecent 5 charts:`);
    recentCharts.forEach(chart => {
      console.log(`- #${chart.id}: "${chart.title}" - ${chart.downloadUrl ? 'HAS URL' : 'NO URL'}`);
    });
    
    // Count charts missing download URLs
    const chartsWithoutUrls = await db.queryCharts({ hasDownload: false });
    console.log(`\nCharts missing download URL: ${chartsWithoutUrls.length}`);
    
  } catch (error) {
    console.error('Error searching charts:', error);
  }
  
  db.close();
}

searchCharts().catch(console.error);
