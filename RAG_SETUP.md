# RAG (Retrieval-Augmented Generation) Setup Guide

This document explains how to set up and use the RAG functionality for handling large document processing in the Accounting AI application.

## Overview

The RAG system automatically processes large text extractions (over 4096 characters) from uploaded documents by:
1. Splitting the text into manageable chunks
2. Generating embeddings using OpenAI's embedding models
3. Storing embeddings in Pinecone vector database
4. Enabling semantic search during chat interactions

## Prerequisites

1. **Pinecone Account**: Sign up at [pinecone.io](https://pinecone.io)
2. **OpenAI Account**: Sign up at [openai.com](https://openai.com)

## Setup Instructions

### 1. Create Pinecone Index

1. Log into your Pinecone dashboard
2. Create a new index with the following settings:
   - **Name**: `accounting-documents` (or customize in env vars)
   - **Dimensions**: `1536` (for text-embedding-3-small model)
   - **Metric**: `cosine`
   - **Pod Type**: `starter` (for free tier) or `s1` for better performance

### 2. Environment Variables

Add the following to your `.env` file:

```bash
# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_INDEX_NAME=accounting-documents

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Get API Keys

#### Pinecone API Key
1. Go to Pinecone dashboard
2. Navigate to "API Keys" section
3. Copy your API key

#### OpenAI API Key
1. Go to OpenAI dashboard
2. Navigate to "API Keys" section
3. Create a new API key
4. Copy the key

## How It Works

### Upload Process

1. **File Processing**: When a document is uploaded, text is extracted
2. **Size Check**: If extracted text > 4096 characters:
   - Text is split into overlapping chunks (~3000 chars each)
   - Each chunk gets embedded using OpenAI's text-embedding-3-small
   - Embeddings are stored in Pinecone with metadata
3. **Transaction Extraction**: The system still processes transactions from the first part of the document

### Chat Integration

1. **Query Analysis**: When a user asks a question, the system determines if it needs:
   - Database queries (for transaction data)
   - Document search (for content details)
   - Both
2. **RAG Search**: For document content questions:
   - User query is embedded
   - Pinecone finds most relevant document chunks
   - Relevant content is provided as context to the LLM
3. **Combined Response**: The LLM can use both transaction data and document content

## Usage Examples

### Questions That Use RAG
- "What are the account fees mentioned in the statement?"
- "Find information about overdraft policies"
- "What interest rates are specified in the document?"
- "Search for terms and conditions"

### Questions That Use Database
- "What's my total spending this month?"
- "Show me all transactions over $100"
- "What's my average transaction amount?"

### Questions That Use Both
- "Based on the fee structure in my statement, how much did I pay in fees?"
- "Compare my spending to the limits mentioned in the document"

## Configuration Options

### Chunk Settings (in embeddings.ts)
```typescript
const CHUNK_SIZE = 3000; // Maximum characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks
```

### Embedding Model
```typescript
const EMBEDDING_MODEL = 'text-embedding-3-small'; // OpenAI model
```

### Search Parameters
```typescript
// In chat queries
const topK = 3; // Number of relevant chunks to retrieve
```

## Troubleshooting

### Common Issues

1. **"Connection not found" error**
   - Check PINECONE_API_KEY is correct
   - Verify index name matches PINECONE_INDEX_NAME

2. **"Embeddings failed" error**
   - Check OPENAI_API_KEY is valid
   - Ensure you have OpenAI API credits

3. **"Index not found" error**
   - Verify the Pinecone index exists
   - Check index name spelling

4. **No RAG results in chat**
   - Upload a large document first (>4096 chars)
   - Wait for processing to complete
   - Try more specific search terms

### Debug Mode

Enable debug logging by adding:
```bash
DEBUG=embeddings,pinecone
```

### Manual Testing

Test your setup with:
```bash
# Test Pinecone connection
npm run test:pinecone

# Test OpenAI embeddings
npm run test:embeddings
```

## Performance Considerations

1. **Embedding Costs**: OpenAI charges per token for embeddings
2. **Pinecone Costs**: Free tier has limits, paid tiers offer better performance
3. **Processing Time**: Large documents take time to process and embed

## Security

1. **API Keys**: Never commit API keys to version control
2. **Access Control**: Pinecone indexes are private to your account
3. **Data Privacy**: Document content is stored in Pinecone embeddings

## Monitoring

Monitor your usage:
1. **OpenAI Usage**: Check token usage in OpenAI dashboard
2. **Pinecone Usage**: Monitor query and storage usage in Pinecone dashboard
3. **Application Logs**: Check console for RAG processing logs
