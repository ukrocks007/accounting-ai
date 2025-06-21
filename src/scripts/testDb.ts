#!/usr/bin/env node

/**
 * Quick test of the database manager functionality
 */

import { dbManager } from '../lib/dbManager';

async function testDatabaseManager() {
  console.log('🧪 Testing Database Manager...');
  
  try {
    // Initialize tables
    console.log('1. Initializing tables...');
    await dbManager.initializeTables();
    console.log('   ✅ Tables initialized');
    
    // Test saving statements
    console.log('2. Testing statement operations...');
    const testStatements = [
      {
        date: '2024-01-15',
        description: 'Test Transaction 1',
        amount: 100.50,
        type: 'credit' as const,
        source: 'test'
      },
      {
        date: '2024-01-16',
        description: 'Test Transaction 2',
        amount: 50.25,
        type: 'debit' as const,
        source: 'test'
      }
    ];
    
    await dbManager.saveStatements(testStatements);
    console.log('   ✅ Statements saved');
    
    // Test retrieving statements
    const retrievedStatements = await dbManager.getStatements({ limit: 10 });
    console.log(`   ✅ Retrieved ${retrievedStatements.length} statements`);
    
    // Test processing jobs
    console.log('3. Testing processing job operations...');
    await dbManager.addProcessingJob({
      filename: 'test_file.pdf',
      fileType: 'pdf',
      uploadDate: '2024-01-15T10:30:00Z',
      status: 'pending',
      totalChunks: 5
    });
    console.log('   ✅ Processing job added');
    
    const pendingJobs = await dbManager.getProcessingJobs({ status: 'pending' });
    console.log(`   ✅ Retrieved ${pendingJobs.length} pending jobs`);
    
    // Test retry mechanism
    console.log('4. Testing retry mechanism...');
    
    // Simulate a failed job
    await dbManager.updateProcessingJobStatus('test_file.pdf', 'failed', 'Test error');
    console.log('   ✅ Job marked as failed');
    
    // Test retry
    const retrySuccess = await dbManager.retryProcessingJob('test_file.pdf');
    console.log(`   ✅ Retry attempt: ${retrySuccess ? 'Success' : 'Failed'}`);
    
    // Test retry eligible jobs
    const retryEligible = await dbManager.getRetryEligibleJobs();
    console.log(`   ✅ Found ${retryEligible.length} retry eligible jobs`);
    
    // Test setting max retries
    await dbManager.setJobMaxRetries('test_file.pdf', 5);
    console.log('   ✅ Max retries updated');
    
    // Test statistics
    console.log('5. Testing statistics...');
    const stats = await dbManager.getStatistics();
    console.log(`   ✅ Statistics: ${stats.statementsCount} statements, ${stats.processingJobsCount} jobs`);
    console.log(`      Retry eligible: ${stats.retryEligibleJobsCount}, Max retries exceeded: ${stats.maxRetriesExceededCount}`);
    
    // Test schema
    console.log('6. Testing schema retrieval...');
    const schema = await dbManager.getSchema();
    console.log(`   ✅ Schema: ${schema.tables.length} tables`);
    
    // Clean up test data
    console.log('7. Cleaning up test data...');
    await dbManager.deleteStatements({ source: 'test' });
    await dbManager.deleteProcessingJobs({ filename: 'test_file.pdf' });
    console.log('   ✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! Database Manager is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if this script is called directly
if (require.main === module) {
  testDatabaseManager().then(() => {
    console.log('\n✅ Database Manager test completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test error:', error);
    process.exit(1);
  });
}

export { testDatabaseManager };
