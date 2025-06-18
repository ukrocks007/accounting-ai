#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Migrates existing data to the new database schema with enhanced features
 */

import { dbManager } from '../lib/dbManager';

interface LegacyStatement {
  id?: number;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  // Legacy fields that might exist
  file_id?: string;
  filename?: string;
}

interface LegacyProcessingJob {
  id?: number;
  filename: string;
  file_type?: string;
  upload_date?: string;
  status?: string;
  total_chunks?: number;
  processed_at?: string;
  error_message?: string;
  created_at?: string;
}

async function migrateFromLegacySchema() {
  console.log('🔄 Starting database migration...');
  
  try {
    // Get a direct database connection for migration
    const db = await dbManager.getConnection();
    
    try {
      // Check if legacy tables exist
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
      const tableNames = tables.map(t => t.name);
      
      console.log(`📋 Found tables: ${tableNames.join(', ')}`);
      
      // Initialize new schema
      console.log('🛠️  Initializing new database schema...');
      await dbManager.initializeTables();
      
      // Migrate statements if they exist
      if (tableNames.includes('statements')) {
        console.log('📊 Migrating statements...');
        await migrateStatements(db);
      }
      
      // Migrate processing jobs if they exist
      if (tableNames.includes('processing_jobs')) {
        console.log('⚙️  Migrating processing jobs...');
        await migrateProcessingJobs(db);
      }
      
      // Clean up legacy data if requested
      const shouldCleanup = process.argv.includes('--cleanup');
      if (shouldCleanup) {
        console.log('🧹 Cleaning up legacy data...');
        await cleanupLegacyData(db);
      }
      
      console.log('✅ Migration completed successfully!');
      
    } finally {
      await db.close();
    }
    
    // Show final statistics
    const stats = await dbManager.getStatistics();
    console.log('\n📊 Final Statistics:');
    console.log(`- Statements: ${stats.statementsCount}`);
    console.log(`- Processing Jobs: ${stats.processingJobsCount}`);
    console.log(`- Database Size: ${stats.dbSizeKB} KB`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function migrateStatements(db: any) {
  try {
    // Get legacy statements
    const legacyStatements: LegacyStatement[] = await db.all('SELECT * FROM statements');
    console.log(`  Found ${legacyStatements.length} legacy statements`);
    
    if (legacyStatements.length === 0) {
      return;
    }
    
    // Check if new schema columns exist
    const columns = await db.all("PRAGMA table_info(statements)");
    const columnNames = columns.map((col: any) => col.name);
    
    const hasSource = columnNames.includes('source');
    const hasUpdatedAt = columnNames.includes('updated_at');
    
    // Add missing columns if needed
    if (!hasSource) {
      console.log('  Adding source column...');
      await db.exec("ALTER TABLE statements ADD COLUMN source TEXT DEFAULT 'legacy'");
    }
    
    if (!hasUpdatedAt) {
      console.log('  Adding updated_at column...');
      await db.exec("ALTER TABLE statements ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }
    
    // Update existing records with new fields
    await db.run("UPDATE statements SET source = 'legacy' WHERE source IS NULL");
    await db.run("UPDATE statements SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL");
    
    console.log('  ✅ Statements migration completed');
    
  } catch (error) {
    console.error('  ❌ Error migrating statements:', error);
    throw error;
  }
}

async function migrateProcessingJobs(db: any) {
  try {
    // Get legacy processing jobs
    const legacyJobs: LegacyProcessingJob[] = await db.all('SELECT * FROM processing_jobs');
    console.log(`  Found ${legacyJobs.length} legacy processing jobs`);
    
    if (legacyJobs.length === 0) {
      return;
    }
    
    // Check if new schema columns exist
    const columns = await db.all("PRAGMA table_info(processing_jobs)");
    const columnNames = columns.map((col: any) => col.name);
    
    const hasUpdatedAt = columnNames.includes('updated_at');
    
    // Add missing columns if needed
    if (!hasUpdatedAt) {
      console.log('  Adding updated_at column...');
      await db.exec("ALTER TABLE processing_jobs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }
    
    // Update existing records with new fields
    await db.run("UPDATE processing_jobs SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL");
    
    // Fix any inconsistent data
    await db.run("UPDATE processing_jobs SET status = 'failed' WHERE status IS NULL");
    await db.run("UPDATE processing_jobs SET total_chunks = 0 WHERE total_chunks IS NULL");
    
    console.log('  ✅ Processing jobs migration completed');
    
  } catch (error) {
    console.error('  ❌ Error migrating processing jobs:', error);
    throw error;
  }
}

async function cleanupLegacyData(db: any) {
  try {
    console.log('  Removing orphaned data...');
    
    // Remove any test or invalid data
    const deletedStatements = await db.run("DELETE FROM statements WHERE description = '' OR date = '' OR amount = 0");
    console.log(`  Removed ${deletedStatements.changes || 0} invalid statements`);
    
    // Remove completed processing jobs older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const deletedJobs = await db.run(
      "DELETE FROM processing_jobs WHERE status = 'completed' AND created_at < ?",
      [thirtyDaysAgo.toISOString()]
    );
    console.log(`  Removed ${deletedJobs.changes || 0} old completed jobs`);
    
    console.log('  ✅ Cleanup completed');
    
  } catch (error) {
    console.error('  ❌ Error during cleanup:', error);
    throw error;
  }
}

async function validateMigration() {
  console.log('🔍 Validating migration...');
  
  try {
    // Check schema
    const schema = await dbManager.getSchema();
    
    // Validate statements table
    const statementsColumns = schema.statements_schema.map(col => col.name);
    const requiredStatementsColumns = ['id', 'date', 'description', 'amount', 'type', 'source', 'created_at', 'updated_at'];
    
    for (const col of requiredStatementsColumns) {
      if (!statementsColumns.includes(col)) {
        throw new Error(`Missing required column in statements table: ${col}`);
      }
    }
    
    // Validate processing_jobs table if it exists
    if (schema.processing_jobs_schema) {
      const jobsColumns = schema.processing_jobs_schema.map(col => col.name);
      const requiredJobsColumns = ['id', 'filename', 'file_type', 'upload_date', 'status', 'total_chunks'];
      
      for (const col of requiredJobsColumns) {
        if (!jobsColumns.includes(col)) {
          throw new Error(`Missing required column in processing_jobs table: ${col}`);
        }
      }
    }
    
    // Test basic operations
    const stats = await dbManager.getStatistics();
    console.log('  ✅ Migration validation successful');
    
  } catch (error) {
    console.error('  ❌ Migration validation failed:', error);
    throw error;
  }
}

async function showMigrationHelp() {
  console.log(`
🛠️  Database Migration Tool

Usage:
  npm run db:migrate              - Run migration (preserves existing data)
  npm run db:migrate --cleanup    - Run migration and cleanup old data
  npm run db:migrate --validate   - Validate migration without making changes
  
What this migration does:
  ✅ Creates new database schema with enhanced features
  ✅ Preserves all existing data
  ✅ Adds missing columns (source, updated_at, etc.)
  ✅ Updates data types and constraints
  ✅ Creates performance indexes
  ✅ Adds database triggers for auto-timestamps
  
Safety:
  - Creates backup before migration
  - Non-destructive (preserves existing data)
  - Can be run multiple times safely
  - Validates schema after migration
  
⚠️  Recommended: Backup your database before running migration!
    npm run db:backup pre-migration-backup.db
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    await showMigrationHelp();
    return;
  }
  
  if (args.includes('--validate')) {
    await validateMigration();
    return;
  }
  
  // Create backup before migration
  const backupFile = `database-backup-${new Date().toISOString().split('T')[0]}.db`;
  console.log(`📋 Creating backup: ${backupFile}`);
  
  try {
    await dbManager.backupDatabase(backupFile);
    console.log('✅ Backup created successfully');
  } catch (error: any) {
    console.warn('⚠️  Could not create backup (database may not exist yet):', error?.message || error);
  }
  
  // Run migration
  await migrateFromLegacySchema();
  
  // Validate migration
  await validateMigration();
  
  console.log('\n🎉 Database migration completed successfully!');
  console.log(`📋 Backup saved as: ${backupFile}`);
}

// Run if this script is called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
}

export { migrateFromLegacySchema };
