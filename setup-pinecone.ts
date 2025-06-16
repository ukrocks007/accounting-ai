#!/usr/bin/env node

/**
 * Pinecone Index Setup Script
 * This script helps you create the required Pinecone index for RAG functionality
 */

import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function setupPineconeIndex(): Promise<void> {
  console.log('🔧 Setting up Pinecone index for RAG functionality...\n');
  
  // Check environment variables
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY not found in .env');
    console.log('💡 Please add your Pinecone API key to .env:');
    console.log('   PINECONE_API_KEY=your-api-key-here\n');
    process.exit(1);
  }
  
  const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'accounting-documents';
  
  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    console.log('✅ Pinecone client initialized');
    
    // Check if index already exists
    const indexes = await pinecone.listIndexes();
    const existingIndex = indexes.indexes?.find((index) => index.name === INDEX_NAME);
    
    if (existingIndex) {
      console.log(`✅ Index "${INDEX_NAME}" already exists`);
      console.log(`   Status: ${existingIndex.status?.state}`);
      console.log(`   Dimension: ${existingIndex.dimension}`);
      console.log(`   Metric: ${existingIndex.metric}`);
      
      if (existingIndex.dimension !== 1536) {
        console.log('\n⚠️  Warning: Index dimension is not 1536 (required for text-embedding-3-small)');
        console.log('   You may need to create a new index with the correct dimension.');
      }
      
      return;
    }
    
    // Create new index
    console.log(`🚀 Creating new index "${INDEX_NAME}"...`);
    
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: 1536, // for text-embedding-3-small
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    console.log(`✅ Index "${INDEX_NAME}" created successfully!`);
    console.log('\n📋 Index Details:');
    console.log(`   Name: ${INDEX_NAME}`);
    console.log('   Dimension: 1536');
    console.log('   Metric: cosine');
    console.log('   Type: Serverless (AWS us-east-1)');
    
    console.log('\n🎉 Pinecone setup complete!');
    console.log('   You can now use RAG functionality with large documents.');
    
  } catch (error) {
    console.error('❌ Error setting up Pinecone index:', error);
    
    if (error instanceof Error) {
      if (error.message?.includes('already exists')) {
        console.log('💡 Index already exists, checking status...');
        // Continue with status check
      } else if (error.message?.includes('Invalid API key')) {
        console.log('💡 Please check your PINECONE_API_KEY in .env');
      } else if (error.message?.includes('quota')) {
        console.log('💡 You may have reached your Pinecone quota. Check your dashboard.');
      } else {
        console.log('💡 Please check your Pinecone account and API key.');
      }
    }
    
    process.exit(1);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📖 Pinecone Setup Script

This script creates a Pinecone index for RAG functionality.

Usage:
  npx ts-node setup-pinecone.ts

Requirements:
  - PINECONE_API_KEY in .env
  - Active Pinecone account

The script will create an index with these specifications:
  - Name: accounting-documents (or PINECONE_INDEX_NAME from env)
  - Dimension: 1536 (for OpenAI text-embedding-3-small)
  - Metric: cosine
  - Type: Serverless (AWS us-east-1)

For more information, see RAG_SETUP.md
`);
  process.exit(0);
}

// Run setup
setupPineconeIndex();
