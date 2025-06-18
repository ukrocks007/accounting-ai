# Background Processing for Large Documents

This implementation adds automatic background processing for large documents that are stored with RAG (Retrieval-Augmented Generation) when they exceed the LLM context window size.

## How it Works

1. **Document Upload**: When a document larger than 4KB is uploaded:
   - Document is chunked and embeddings are created
   - Embeddings are stored in Pinecone
   - A processing job is added to the queue

2. **Background Processing**: A background processor runs every 5 minutes:
   - Retrieves pending jobs from the processing queue
   - For each job, searches Pinecone for all chunks related to the document
   - Uses LLM to extract transactions from the combined document content
   - Saves extracted transactions to SQLite database
   - Removes embeddings from Pinecone after successful processing

3. **Cleanup**: After successful processing:
   - Transactions are available in the database for querying
   - Embeddings are removed from Pinecone to save storage costs
   - Processing job status is updated to "completed"

## Database Schema

### Processing Jobs Table
```sql
CREATE TABLE processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE,
  file_type TEXT,
  upload_date TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  total_chunks INTEGER,
  processed_at TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Statements Table (Enhanced)
```sql
CREATE TABLE statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  description TEXT,
  amount REAL,
  type TEXT,  -- 'credit' or 'debit'
  source TEXT DEFAULT 'background_processed',  -- Tracks source of transaction
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Background Processing Status
- **GET** `/api/background-process?action=status`
  - Returns summary of processing jobs and detailed job list

### Manual Processing Trigger
- **POST** `/api/background-process`
  - Body: `{ "action": "process" }`
  - Manually triggers processing of pending jobs

## Admin Interface

Visit `/admin/background-processing` to:
- View processing job statistics
- Monitor job status and progress
- Manually trigger background processing
- View error messages for failed jobs

## Key Features

### Automatic Processing
- Background processor initializes when server starts
- Runs automatically every 5 minutes
- Processes jobs sequentially to avoid overwhelming the system

### Error Handling
- Failed jobs are marked with error messages
- Processing continues even if individual jobs fail
- Jobs can be retried manually if needed

### Resource Management
- Embeddings are removed from Pinecone after successful processing
- Reduces storage costs for vector database
- Transactions remain in SQLite for fast querying

### Status Tracking
- Real-time status updates for each processing job
- Detailed error messages for debugging
- Processing timestamps and duration tracking

## Configuration

### Environment Variables
- `PINECONE_API_KEY`: Required for vector storage
- `PINECONE_INDEX_NAME`: Default 'accounting-documents'
- `EMBEDDING_MODEL`: Default 'text-embedding-3-small'

### Processing Intervals
The background processor interval can be adjusted in `backgroundProcessorInit.ts`:
```typescript
// Start with 5-minute intervals (default)
global.backgroundProcessorInterval = startBackgroundProcessor(5);

// Or customize the interval (in minutes)
global.backgroundProcessorInterval = startBackgroundProcessor(10); // 10 minutes
```

## Workflow Example

1. User uploads a large PDF bank statement (8KB)
2. System creates embeddings and stores in Pinecone
3. Processing job is queued with status "pending"
4. Background processor (every 5 minutes):
   - Finds the pending job
   - Retrieves all document chunks from Pinecone
   - Combines chunks and sends to LLM for transaction extraction
   - Saves extracted transactions to SQLite
   - Removes embeddings from Pinecone
   - Updates job status to "completed"
5. Transactions are now available for querying via the chat interface

## Monitoring and Debugging

- Check `/admin/background-processing` for job status
- Monitor server logs for processing details
- Use the manual trigger for immediate processing
- Failed jobs retain error messages for debugging

This system ensures that large documents are fully processed while maintaining efficient resource usage and providing transparency into the processing pipeline.
