#!/usr/bin/env node

/**
 * Database Utility Script
 * 
 * Provides command-line utilities for database operations
 */

import { dbManager } from '../lib/dbManager';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CliOptions {
  command: string;
  args: string[];
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const restArgs = args.slice(1);
  
  return { command, args: restArgs };
}

async function showHelp() {
  console.log(`
🛠️  Database Utility Commands:

📊 Statistics:
  stats                  - Show database statistics
  schema                 - Show database schema
  tables                 - List all tables

💾 Data Operations:
  export-statements [file]   - Export statements to JSON file
  import-statements <file>   - Import statements from JSON file
  clear-statements          - Clear all statements
  clear-jobs               - Clear all processing jobs

🔧 Maintenance:
  init                     - Initialize database tables
  backup <file>            - Backup database to file
  vacuum                   - Optimize database (VACUUM)

🏃 Processing Jobs:
  list-jobs [status]       - List processing jobs (optional status filter)
  retry-failed            - Retry all failed processing jobs
  retry-job <filename>    - Retry a specific failed job
  job-status              - Show detailed retry status for all jobs
  set-max-retries <filename> <count> - Set max retries for a job

📋 Examples:
  npm run db stats
  npm run db schema
  npm run db export-statements statements.json
  npm run db backup backup-$(date +%Y%m%d).db
  npm run db list-jobs failed
`);
}

async function showStats() {
  console.log('📊 Database Statistics:');
  console.log('─'.repeat(50));
  
  const stats = await dbManager.getStatistics();
  
  console.log(`Statements: ${stats.statementsCount.toLocaleString()}`);
  console.log(`Processing Jobs: ${stats.processingJobsCount.toLocaleString()}`);
  console.log(`  - Pending: ${stats.pendingJobsCount}`);
  console.log(`  - Completed: ${stats.completedJobsCount}`);
  console.log(`  - Failed: ${stats.failedJobsCount}`);
  console.log(`    • Retry Eligible: ${stats.retryEligibleJobsCount}`);
  console.log(`    • Max Retries Exceeded: ${stats.maxRetriesExceededCount}`);
  console.log(`\nFinancial Summary:`);
  console.log(`  - Total Credits: $${stats.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`  - Total Debits: $${stats.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`  - Net Balance: $${(stats.totalCredits - stats.totalDebits).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`\nDatabase Size: ${stats.dbSizeKB.toLocaleString()} KB`);
}

async function showSchema() {
  console.log('🗂️  Database Schema:');
  console.log('─'.repeat(50));
  
  const schema = await dbManager.getSchema();
  
  console.log('\nTables:');
  schema.tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  
  console.log('\nStatements Table Schema:');
  schema.statements_schema.forEach(col => {
    const nullText = col.notnull ? 'NOT NULL' : 'NULL';
    const pkText = col.pk ? ' (PRIMARY KEY)' : '';
    console.log(`  - ${col.name}: ${col.type} ${nullText}${pkText}`);
  });
  
  if (schema.processing_jobs_schema) {
    console.log('\nProcessing Jobs Table Schema:');
    schema.processing_jobs_schema.forEach(col => {
      const nullText = col.notnull ? 'NOT NULL' : 'NULL';
      const pkText = col.pk ? ' (PRIMARY KEY)' : '';
      console.log(`  - ${col.name}: ${col.type} ${nullText}${pkText}`);
    });
  }
  
  console.log('\nSample Data (first 3 statements):');
  schema.sample_data.slice(0, 3).forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.date} - ${row.description} - $${row.amount} (${row.type})`);
  });
}

async function exportStatements(filename: string) {
  const statements = await dbManager.getStatements();
  const outputPath = path.resolve(filename);
  
  await fs.writeFile(outputPath, JSON.stringify(statements, null, 2));
  console.log(`✅ Exported ${statements.length} statements to ${outputPath}`);
}

async function importStatements(filename: string) {
  const inputPath = path.resolve(filename);
  
  try {
    const data = await fs.readFile(inputPath, 'utf-8');
    const statements = JSON.parse(data);
    
    if (!Array.isArray(statements)) {
      throw new Error('Invalid JSON format: expected array of statements');
    }
    
    await dbManager.saveStatements(statements);
    console.log(`✅ Imported ${statements.length} statements from ${inputPath}`);
  } catch (error) {
    console.error(`❌ Error importing statements: ${error}`);
    process.exit(1);
  }
}

async function clearStatements() {
  const deleted = await dbManager.deleteStatements({ source: undefined });
  console.log(`✅ Cleared ${deleted} statements from database`);
}

async function clearJobs() {
  const deleted = await dbManager.deleteProcessingJobs({});
  console.log(`✅ Cleared ${deleted} processing jobs from database`);
}

async function listJobs(statusFilter?: string) {
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  
  if (statusFilter && !validStatuses.includes(statusFilter)) {
    console.error(`❌ Invalid status: ${statusFilter}. Valid: ${validStatuses.join(', ')}`);
    return;
  }
  
  const jobs = await dbManager.getProcessingJobs({ 
    status: statusFilter as any 
  });
  
  console.log(`📋 Processing Jobs${statusFilter ? ` (${statusFilter})` : ''}:`);
  console.log('─'.repeat(80));
  
  if (jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }
  
  jobs.forEach((job, i) => {
    const retryInfo = job.retryCount ? ` (retry ${job.retryCount}/${job.maxRetries || 3})` : '';
    const errorText = job.errorMessage ? ` - Error: ${job.errorMessage}` : '';
    console.log(`${i + 1}. ${job.filename}${retryInfo}`);
    console.log(`   Status: ${job.status} | Chunks: ${job.totalChunks} | Upload: ${job.uploadDate}${errorText}`);
  });
}

async function retrySpecificJob(filename: string) {
  const success = await dbManager.retryProcessingJob(filename);
  
  if (success) {
    console.log(`✅ Job ${filename} has been queued for retry`);
  } else {
    console.log(`❌ Could not retry job ${filename} (may not exist, not failed, or exceeded max retries)`);
  }
}

async function showJobRetryStatus() {
  console.log('📊 Job Retry Status:');
  console.log('─'.repeat(60));
  
  const retryEligible = await dbManager.getRetryEligibleJobs();
  const allFailed = await dbManager.getProcessingJobs({ status: 'failed' });
  
  const maxRetriesExceeded = allFailed.filter(job => {
    const retryCount = job.retryCount || 0;
    const maxRetries = job.maxRetries || 3;
    return retryCount >= maxRetries;
  });
  
  console.log(`Total Failed Jobs: ${allFailed.length}`);
  console.log(`Retry Eligible: ${retryEligible.length}`);
  console.log(`Max Retries Exceeded: ${maxRetriesExceeded.length}`);
  
  if (retryEligible.length > 0) {
    console.log('\n🔄 Retry Eligible Jobs:');
    retryEligible.forEach((job, i) => {
      const retryCount = job.retryCount || 0;
      const maxRetries = job.maxRetries || 3;
      console.log(`  ${i + 1}. ${job.filename} (${retryCount}/${maxRetries} retries)`);
      if (job.errorMessage) {
        console.log(`     Error: ${job.errorMessage}`);
      }
    });
  }
  
  if (maxRetriesExceeded.length > 0) {
    console.log('\n⛔ Max Retries Exceeded:');
    maxRetriesExceeded.forEach((job, i) => {
      const retryCount = job.retryCount || 0;
      const maxRetries = job.maxRetries || 3;
      console.log(`  ${i + 1}. ${job.filename} (${retryCount}/${maxRetries} retries)`);
      if (job.errorMessage) {
        console.log(`     Last Error: ${job.errorMessage}`);
      }
    });
  }
}

async function setJobMaxRetries(filename: string, maxRetries: number) {
  if (isNaN(maxRetries) || maxRetries < 0) {
    console.error('❌ Max retries must be a positive number');
    return;
  }
  
  await dbManager.setJobMaxRetries(filename, maxRetries);
  console.log(`✅ Set max retries for ${filename} to ${maxRetries}`);
}

async function backupDatabase(filename: string) {
  const outputPath = path.resolve(filename);
  await dbManager.backupDatabase(outputPath);
  console.log(`✅ Database backed up to ${outputPath}`);
}

async function vacuumDatabase() {
  console.log('🔧 Optimizing database...');
  const db = await dbManager.getConnection();
  
  try {
    await db.exec('VACUUM');
    console.log('✅ Database optimization complete');
  } finally {
    await db.close();
  }
}

async function main() {
  const { command, args } = parseArgs();
  
  try {
    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        await showHelp();
        break;
        
      case 'stats':
        await showStats();
        break;
        
      case 'schema':
        await showSchema();
        break;
        
      case 'tables':
        const schema = await dbManager.getSchema();
        console.log('📋 Tables:', schema.tables.map(t => t.name).join(', '));
        break;
        
      case 'export-statements':
        if (!args[0]) {
          console.error('❌ Please provide a filename: export-statements <filename>');
          process.exit(1);
        }
        await exportStatements(args[0]);
        break;
        
      case 'import-statements':
        if (!args[0]) {
          console.error('❌ Please provide a filename: import-statements <filename>');
          process.exit(1);
        }
        await importStatements(args[0]);
        break;
        
      case 'clear-statements':
        await clearStatements();
        break;
        
      case 'clear-jobs':
        await clearJobs();
        break;
        
      case 'list-jobs':
        await listJobs(args[0]);
        break;
        
      case 'retry-failed':
        const result = await dbManager.retryAllFailedJobs();
        console.log(`✅ Retry operation completed: ${result.retried} jobs retried, ${result.skipped} jobs skipped`);
        break;
        
      case 'retry-job':
        if (!args[0]) {
          console.error('❌ Please provide a filename: retry-job <filename>');
          process.exit(1);
        }
        await retrySpecificJob(args[0]);
        break;
        
      case 'job-status':
        await showJobRetryStatus();
        break;
        
      case 'set-max-retries':
        if (!args[0] || !args[1]) {
          console.error('❌ Please provide filename and retry count: set-max-retries <filename> <count>');
          process.exit(1);
        }
        await setJobMaxRetries(args[0], parseInt(args[1]));
        break;
        
      case 'init':
        await dbManager.initializeTables();
        console.log('✅ Database initialized');
        break;
        
      case 'backup':
        if (!args[0]) {
          console.error('❌ Please provide a filename: backup <filename>');
          process.exit(1);
        }
        await backupDatabase(args[0]);
        break;
        
      case 'vacuum':
        await vacuumDatabase();
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "npm run db help" for available commands.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

// Run if this script is called directly
if (require.main === module) {
  main();
}
