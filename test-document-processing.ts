#!/usr/bin/env node

/**
 * Test script for document processing without Pinecone
 */

import { processDocumentForBackgroundProcessing, getDocumentChunksForProcessing } from './src/utils/documentProcessor';
import { dbManager } from './src/lib/dbManager';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

console.log('Environment variables check:');
console.log('GITHUB_TOKEN exists:', !!process.env.GITHUB_TOKEN);

// Test function to verify document processing without Pinecone
async function testDocumentProcessing(): Promise<void> {
  console.log('Testing document processing without Pinecone...\n');
  
  try {
    // Test with a sample document
    const testDocument: string = `
      This is a test financial document with transaction information.
      
      Transaction 1:
      Date: 2024-01-15
      Description: Direct Deposit - Salary
      Amount: $5,000.00
      Balance: $5,000.00
      
      Transaction 2:
      Date: 2024-01-16
      Description: ATM Withdrawal
      Amount: -$100.00
      Balance: $4,900.00
      
      Transaction 3:
      Date: 2024-01-17
      Description: Grocery Store Purchase
      Amount: -$85.32
      Balance: $4,814.68
      
      Additional information about account fees:
      - Monthly maintenance fee: $12.00 for accounts with balances below $1,500
      - Overdraft fees: $35.00 per occurrence  
      - ATM fees: $2.50 for out-of-network transactions
      - Interest rates for savings accounts: 0.05% APY
      - Wire transfer fees: $25.00 for domestic transfers
      - Check ordering fees: $15.00 for basic checks
      - Stop payment fees: $30.00 per request
      - Account closure fees may apply if closed within 90 days
      
      Important terms and conditions:
      - Minimum balance requirements vary by account type
      - Business accounts have different fee structures
      - Student accounts may qualify for fee waivers
      - Senior citizens over 65 may be eligible for reduced fees
      - Online banking is provided at no additional cost
      - Mobile deposit limits are $5,000 per day
      - Bill pay services are included with checking accounts
      - Debit card replacement fees are $5.00 for standard delivery
      - Foreign transaction fees are 3% of transaction amount
    `.repeat(10); // Make it large enough to trigger background processing
    
    console.log(`Test document length: ${testDocument.length} characters`);
    
    // Initialize database tables
    await dbManager.initializeTables();
    
    // Process document
    const result = await processDocumentForBackgroundProcessing(
      testDocument, 
      'test-document.txt', 
      'txt'
    );
    console.log('Document processing result:', result);
    
    if (result.stored) {
      console.log('✅ Document successfully stored for background processing');
      
      // Test retrieving chunks
      const chunks = await getDocumentChunksForProcessing('test-document.txt');
      console.log(`Retrieved ${chunks.length} chunks`);
      
      if (chunks.length > 0) {
        console.log('✅ Chunk retrieval working correctly');
        console.log('Sample chunk preview:', chunks[0].text.substring(0, 200) + '...');
      } else {
        console.log('❌ No chunks retrieved');
      }
      
      // Test search functionality
      const { searchRelevantContent } = await import('./src/utils/documentProcessor');
      const searchResults = await searchRelevantContent('transaction fee', 3);
      console.log(`Search results found: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        console.log('✅ Document search working correctly');
        console.log('Sample search result:', searchResults[0].text.substring(0, 200) + '...');
      } else {
        console.log('❌ Document search returned no results');
      }
      
      // Get statistics
      const stats = await dbManager.getChunkStatistics();
      console.log('\n📊 Chunk statistics:');
      console.log(`   - Total chunks: ${stats.totalChunks}`);
      console.log(`   - Total files: ${stats.totalFiles}`);
      console.log(`   - Average chunk size: ${stats.averageChunkSize} characters`);
      console.log(`   - Total text size: ${stats.totalTextSize} characters`);
      
    } else {
      console.log('❌ Document was not stored (likely too small)');
    }
    
    console.log('\n🎉 Document processing test completed successfully!');
    
  } catch (error) {
    console.error('❌ Document processing test failed:', error);
    
    if (error instanceof Error) {
      console.log('💡 Error details:', error.message);
    }
  }
}

// Run test if called directly
if (require.main === module) {
  testDocumentProcessing();
}

export default testDocumentProcessing;
