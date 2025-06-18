#!/usr/bin/env node

/**
 * Database Migration Script
 * This script adds the document_chunks table to existing databases
 */

import { dbManager } from './src/lib/dbManager';

async function migrateDatabase(): Promise<void> {
  console.log('🔧 Running database migration to add document_chunks table...\n');
  
  try {
    // Initialize database (this will create the new table if it doesn't exist)
    await dbManager.initializeTables();
    
    console.log('✅ Database migration completed successfully!');
    console.log('📋 Changes made:');
    console.log('   - Added document_chunks table');
    console.log('   - Added indexes for document_chunks');
    console.log('   - Existing data preserved\n');
    
    // Get some statistics
    const stats = await dbManager.getChunkStatistics();
    console.log('📊 Current chunk statistics:');
    console.log(`   - Total chunks: ${stats.totalChunks}`);
    console.log(`   - Total files with chunks: ${stats.totalFiles}`);
    console.log(`   - Average chunk size: ${stats.averageChunkSize} characters`);
    console.log(`   - Total text size: ${stats.totalTextSize} characters\n`);
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    
    if (error instanceof Error) {
      console.log('💡 Error details:', error.message);
    }
    
    process.exit(1);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📖 Database Migration Script

This script updates the database schema to support document chunks stored locally
instead of using Pinecone for chunk storage.

Usage:
  npm run migrate

What it does:
  - Creates document_chunks table if it doesn't exist
  - Adds necessary indexes for performance
  - Preserves all existing data
  - Shows current statistics

Requirements:
  - Existing SQLite database
  - Write permissions to database file

The migration is safe to run multiple times.
`);
  process.exit(0);
}

// Run migration
migrateDatabase();
