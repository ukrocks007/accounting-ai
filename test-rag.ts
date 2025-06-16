/**
 * Test utilities for RAG functionality
 */

import { processDocumentForRAG, searchRelevantChunks } from './src/utils/embeddings';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

console.log('Environment variables check:');
console.log('GITHUB_TOKEN exists:', !!process.env.GITHUB_TOKEN);
console.log('GITHUB_TOKEN length:', process.env.GITHUB_TOKEN?.length || 0);
console.log('EMBEDDING_MODEL:', process.env.EMBEDDING_MODEL);
console.log('EMBEDDING_ENDPOINT:', process.env.EMBEDDING_ENDPOINT);
console.log('PINECONE_API_KEY exists:', !!process.env.PINECONE_API_KEY);

// Test function to verify Pinecone and OpenAI setup
async function testRAGSetup(): Promise<void> {
  console.log('Testing RAG setup...');
  
  try {
    // Test with a sample document
    const testDocument: string = `
      This is a test financial document with important information about account fees.
      The monthly maintenance fee is $12.00 for accounts with balances below $1,500.
      Overdraft fees are $35.00 per occurrence.
      ATM fees are $2.50 for out-of-network transactions.
      Interest rates for savings accounts are currently 0.05% APY.
      Certificate of deposit rates vary from 0.25% to 2.50% depending on term length.
      Wire transfer fees are $25.00 for domestic transfers and $45.00 for international.
      Check ordering fees are $15.00 for basic checks and $25.00 for premium designs.
      Stop payment fees are $30.00 per request.
      Account closure fees may apply if account is closed within 90 days of opening.
      Minimum balance requirements vary by account type.
      Business accounts have different fee structures than personal accounts.
      Student accounts may qualify for fee waivers with proper documentation.
      Senior citizens over 65 may be eligible for reduced fees.
      Online banking is provided at no additional cost.
      Mobile deposit limits are $5,000 per day for most account types.
      Bill pay services are included with most checking accounts.
      Debit card replacement fees are $5.00 for standard delivery.
      Expedited card delivery is available for $25.00.
      Foreign transaction fees are 3% of the transaction amount.
    `.repeat(20); // Make it large enough for RAG processing
    
    console.log(`Test document length: ${testDocument.length} characters`);
    
    // Process document for RAG
    const result = await processDocumentForRAG(testDocument, 'test-document.txt', 'txt');
    console.log('Document processing result:', result);
    
    if (result.stored) {
      console.log('✅ Document successfully stored in RAG system');
      
      // Test search functionality
      const searchResults = await searchRelevantChunks('overdraft fees', 2);
      console.log('Search results:', searchResults);
      
      if (searchResults.length > 0) {
        console.log('✅ RAG search working correctly');
        console.log('Sample result:', searchResults[0].text.substring(0, 200) + '...');
      } else {
        console.log('❌ RAG search returned no results');
      }
    } else {
      console.log('❌ Document was not stored in RAG system');
    }
    
  } catch (error) {
    console.error('❌ RAG setup test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('PINECONE_API_KEY')) {
        console.log('💡 Make sure PINECONE_API_KEY is set in your .env file');
      }
      if (error.message.includes('OPENAI_API_KEY')) {
        console.log('💡 Make sure OPENAI_API_KEY is set in your .env file');
      }
    }
  }
}

// Run test if called directly
if (require.main === module) {
  testRAGSetup();
}
