# Document Processing Migration: From Pinecone to SQLite

This document outlines the migration from Pinecone-based RAG to SQLite-based document chunk processing.

## Overview

The system has been updated to store document chunks directly in the SQLite database instead of using Pinecone for vector storage. This simplifies the architecture, reduces external dependencies, and eliminates the need for embedding generation while maintaining the background processing functionality.

## Key Changes

### 1. Database Schema Updates

**New Table: `document_chunks`**
```sql
CREATE TABLE document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  file_type TEXT,
  upload_date TEXT,
  chunk_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(filename, chunk_index),
  FOREIGN KEY(filename) REFERENCES processing_jobs(filename) ON DELETE CASCADE
);
```

**New Indexes:**
- `idx_document_chunks_filename` - For filename-based queries
- `idx_document_chunks_filename_index` - For compound queries

### 2. New Files Created

#### `src/utils/documentProcessor.ts`
- Replaces `src/utils/embeddings.ts` for document processing
- Handles chunking without embeddings
- Provides simple text-based search functionality
- Manages chunk storage and retrieval

#### `migrate-chunks.ts`
- Database migration script
- Safe to run multiple times
- Creates new tables and indexes

#### `test-document-processing.ts`
- Test script for the new functionality
- Validates chunk storage, retrieval, and search

### 3. Updated Files

#### `src/lib/dbManager.ts`
- Added `document_chunks` table creation
- New methods for chunk management:
  - `storeDocumentChunks()`
  - `getDocumentChunks()`
  - `deleteDocumentChunks()`
  - `searchDocumentChunks()`
  - `getChunkStatistics()`

#### `src/utils/backgroundProcessor.ts`
- Removed Pinecone dependencies
- Updated to use database chunks instead of vector search
- Simplified chunk retrieval process
- Updated cleanup to remove chunks from database

#### `src/app/api/upload/route.ts`
- Switched from `processDocumentForRAG()` to `processDocumentForBackgroundProcessing()`
- Updated logging messages

#### `src/app/api/chat/route.ts`
- Updated import to use new document processor

#### `src/app/admin/background-processing/page.tsx`
- Updated workflow description to reflect new process

### 4. Removed Dependencies

The following are no longer required:
- Pinecone vector database
- OpenAI embeddings API
- Vector similarity calculations

## Workflow Changes

### Before (Pinecone-based)
1. Document uploaded → Split into chunks
2. Generate embeddings for each chunk
3. Store embeddings in Pinecone
4. Background job searches Pinecone for relevant chunks
5. Process chunks with LLM
6. Clean up embeddings from Pinecone

### After (SQLite-based)
1. Document uploaded → Split into chunks
2. Store chunks directly in SQLite
3. Background job retrieves all chunks from database
4. Process chunks with LLM
5. Clean up chunks from database

## Benefits

### Simplified Architecture
- No external vector database dependency
- Reduced complexity in setup and maintenance
- All data stored locally in SQLite

### Cost Reduction
- No Pinecone subscription costs
- No OpenAI embedding API costs
- Reduced operational complexity

### Improved Reliability
- No network dependencies for chunk retrieval
- Faster chunk access (local database)
- Better error handling and debugging

### Easier Development
- Single database for all data
- Simplified testing and debugging
- No API key management for embeddings

## Migration Steps

### For Existing Installations

1. **Run the migration script:**
   ```bash
   npm run migrate-chunks
   ```

2. **Test the new functionality:**
   ```bash
   npm run test-document-processing
   ```

3. **Update environment variables (optional):**
   - `PINECONE_API_KEY` - Can be removed
   - `PINECONE_INDEX_NAME` - Can be removed
   - `EMBEDDING_MODEL` - Can be removed
   - `EMBEDDING_ENDPOINT` - Can be removed

### For New Installations

1. **Initialize database:**
   ```bash
   npm run db:init
   ```

2. **Test functionality:**
   ```bash
   npm run test-document-processing
   ```

## Search Functionality

### Previous (Vector-based)
- Semantic similarity search using embeddings
- More sophisticated but requires AI model

### Current (Text-based)
- Keyword matching and frequency scoring
- Simple but effective for most use cases
- Can be enhanced with more sophisticated text matching if needed

## Performance Considerations

### Advantages
- Faster chunk retrieval (no API calls)
- No rate limits from external services
- Predictable performance

### Trade-offs
- Less sophisticated search than vector similarity
- All chunks stored locally (higher disk usage)
- Search quality depends on keyword matching

## Monitoring and Administration

### Admin Panel Updates
- Updated workflow descriptions
- Same retry and management functionality
- New chunk statistics available

### Database Monitoring
```bash
# Check chunk statistics
npm run migrate-chunks

# View database schema
npm run db:schema

# Database backup
npm run db:backup
```

## Future Enhancements

### Potential Improvements
1. **Enhanced Search**: Implement TF-IDF or other text ranking algorithms
2. **Chunk Optimization**: Smart chunking based on document structure
3. **Compression**: Store compressed chunks to save space
4. **Indexing**: Full-text search indexes for better performance
5. **Caching**: Frequently accessed chunks in memory

### Migration Path Back to Vector Search
If vector search is needed in the future:
- The chunk data is preserved in the database
- Easy to add embedding generation back
- Can run both systems in parallel for comparison

## Testing

### Automated Tests
```bash
# Test document processing
npm run test-document-processing

# Test database functionality  
npm run db:test
```

### Manual Testing
1. Upload a large document (>4KB)
2. Check admin panel for processing status
3. Verify chunks are stored in database
4. Test chat queries about document content
5. Verify background processing completes successfully

## Troubleshooting

### Common Issues

1. **Migration fails**: Check database permissions and backup existing data
2. **Chunks not found**: Verify document was processed and not cleaned up
3. **Search returns no results**: Check search terms and chunk content
4. **Background processing fails**: Check logs for chunk retrieval errors

### Debug Commands
```bash
# Check database schema
npm run db:schema

# View processing job status
npm run db:job-status

# Test chunk operations
npm run test-document-processing
```

## Conclusion

This migration simplifies the document processing system while maintaining all core functionality. The new approach is more cost-effective, easier to deploy, and provides better performance for most use cases. The background processing and admin functionality remain unchanged, ensuring a smooth transition for end users.
