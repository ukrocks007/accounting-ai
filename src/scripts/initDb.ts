#!/usr/bin/env node

/**
 * Database Initialization Script
 * 
 * This script initializes the database with all required tables and indexes.
 * It can be run standalone or imported and called programmatically.
 */

import { dbManager } from '../lib/dbManager';

async function initializeDatabase() {
  console.log('🔄 Initializing database...');
  
  try {
    // Initialize all tables
    await dbManager.initializeTables();
    
    // Get database statistics
    const stats = await dbManager.getStatistics();
    
    console.log('✅ Database initialized successfully!');
    console.log('\n📊 Database Statistics:');
    console.log(`- Statements: ${stats.statementsCount}`);
    console.log(`- Processing Jobs: ${stats.processingJobsCount}`);
    console.log(`- Pending Jobs: ${stats.pendingJobsCount}`);
    console.log(`- Completed Jobs: ${stats.completedJobsCount}`);
    console.log(`- Failed Jobs: ${stats.failedJobsCount}`);
    console.log(`- Database Size: ${stats.dbSizeKB} KB`);
    
    // Get schema information
    const schema = await dbManager.getSchema();
    console.log(`\n🗂️  Available Tables: ${schema.tables.map(t => t.name).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

// Run if this script is called directly
if (require.main === module) {
  initializeDatabase().then(() => {
    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { initializeDatabase };
