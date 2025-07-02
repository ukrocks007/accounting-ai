import { getDocumentChunksForProcessing, cleanupProcessedDocument } from './documentProcessor';
import { generateCompletion } from './modelUtils';
import { jsonrepair } from "jsonrepair";
import { dbManager, StatementRow, ProcessingJob as DBProcessingJob } from '../lib/dbManager';

// Import SSE broadcasting functions
let broadcastJobUpdate: ((filename: string, jobData: any) => void) | null = null;
let broadcastAdminUpdate: (() => void) | null = null;
let broadcastBackgroundProcessUpdate: ((filename?: string, jobData?: any) => void) | null = null;

// Dynamically import SSE functions to avoid circular dependencies
async function initSSEBroadcasting() {
  try {
    const sseModule = await import('../app/api/sse/route');
    broadcastJobUpdate = sseModule.broadcastJobUpdate;
    
    const adminSSEModule = await import('../app/api/sse/admin/route');
    broadcastAdminUpdate = adminSSEModule.broadcastAdminUpdate;
    
    const backgroundProcessModule = await import('../app/api/background-process/route');
    broadcastBackgroundProcessUpdate = backgroundProcessModule.broadcastBackgroundProcessUpdate;
  } catch (error) {
    console.log('SSE modules not available, continuing without real-time updates');
  }
}

// Type alias for transaction data
type TransactionRow = StatementRow;

// Type alias for processing job
type ProcessingJob = DBProcessingJob;

/**
 * Add a processing job to the queue
 */
export async function addProcessingJob(
  filename: string,
  fileType: string,
  uploadDate: string,
  totalChunks: number
): Promise<void> {
  await dbManager.addProcessingJob({
    filename,
    fileType,
    uploadDate,
    status: 'pending',
    totalChunks
  });
}

/**
 * Get pending processing jobs
 */
async function getPendingJobs(): Promise<ProcessingJob[]> {
  return await dbManager.getProcessingJobs({ status: 'pending' });
}

/**
 * Update job status with retry handling and SSE broadcasting
 */
async function updateJobStatus(
  filename: string,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  if (status === 'failed') {
    // Try to retry the job automatically if it hasn't exceeded max retries
    const retrySuccess = await dbManager.retryProcessingJob(filename);
    if (retrySuccess) {
      console.log(`Job ${filename} automatically queued for retry`);
      
      // Broadcast retry update
      if (broadcastJobUpdate) {
        const jobData = await dbManager.getProcessingJobs({ filename });
        if (jobData.length > 0) {
          broadcastJobUpdate(filename, jobData[0]);
        }
      }
      if (broadcastAdminUpdate) {
        broadcastAdminUpdate();
      }
      
      return; // Don't mark as failed, it's been reset to pending
    }
  }
  
  // If not retrying or if it's not a failure, update normally
  await dbManager.updateProcessingJobStatus(filename, status, errorMessage);
  
  // Broadcast status update via SSE
  if (broadcastJobUpdate) {
    try {
      const jobData = await dbManager.getProcessingJobs({ filename });
      if (jobData.length > 0) {
        broadcastJobUpdate(filename, jobData[0]);
      }
    } catch (error) {
      console.error('Failed to broadcast job update:', error);
    }
  }
  
  // Broadcast to background process SSE connections
  if (broadcastBackgroundProcessUpdate) {
    try {
      const jobData = await dbManager.getProcessingJobs({ filename });
      if (jobData.length > 0) {
        broadcastBackgroundProcessUpdate(filename, jobData[0]);
      }
    } catch (error) {
      console.error('Failed to broadcast background process update:', error);
    }
  }
  
  // Broadcast admin update
  if (broadcastAdminUpdate) {
    try {
      broadcastAdminUpdate();
    } catch (error) {
      console.error('Failed to broadcast admin update:', error);
    }
  }
}

/**
 * Extract transactions from document chunks using LLM
 * Yields transactions as soon as each chunk is processed
 */
async function* extractTransactionsFromChunks(
  chunks: Array<{ text: string; score: number; metadata: Record<string, unknown> }>
): AsyncGenerator<TransactionRow[], void, unknown> {
  // Process chunks individually to avoid token limit issues
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1} of ${chunks.length}`);
    
    try {
      const messages = [
        {
          role: "system" as const,
          content: `You are a helpful assistant. Process the financial document content and extract transactions. 

Make sure you only return the transactions in JSON format and nothing else. Look for information that represents:
- Date (formats DD/MM/YYYY)
- Description/Transaction details/Memo
- Amount (positive or negative numbers, or separate debit/credit columns)
- Transaction type (debit/credit, or infer from amount sign)

In case you are not able to give a response, return an empty array. Extract as many valid transactions as you can find.

The return JSON looks like this:
{
  "rows": [
    {
      "date": "2023-01-01",
      "description": "Sample transaction",
      "amount": 100.0,
      "type": "credit" | "debit"
    }
  ]
}

Important: 
- Convert all dates to YYYY-MM-DD format
- Ensure amounts are positive numbers
- Set type as "debit" for expenses/withdrawals and "credit" for income/deposits
- Clean up descriptions to remove extra spaces and characters
- Only extract clear, valid transactions - skip headers, summaries, or unclear entries
- Make sure to return valid JSON format exactly as mentioned, no additional text or explanations`,
        },
        {
          role: "user" as const,
          content: `Please extract transactions from this financial document chunk:\n\n${chunk.text}`,
        },
      ];

      const response = await generateCompletion(messages, 'upload');
      const result = response.choices[0]?.message?.content;

      try {
        const repairedJson = jsonrepair(result || "");
        const parsedResult = JSON.parse(repairedJson);

        if ((parsedResult?.rows && Array.isArray(parsedResult.rows)) || (Array.isArray(parsedResult) && parsedResult.length > 0)) {
          // Validate and clean up the extracted transactions
          let chunkTransactions = parsedResult.rows || parsedResult;
          chunkTransactions = chunkTransactions
            .filter((row: { date?: unknown; description?: unknown; amount?: unknown }) =>
              row.date && row.description && typeof row.amount === 'number'
            )
            .map((row: { date: string; description: string; amount: number; type?: string }) => ({
              ...row,
              amount: Math.abs(row.amount), // Ensure amount is positive
              type: row.type || 'debit' // Default to 'debit' if type is missing
            }));
          
          if (chunkTransactions.length > 0) {
            console.log(`Extracted ${chunkTransactions.length} transactions from chunk ${i + 1}`);
            yield chunkTransactions; // Yield transactions immediately after processing each chunk
          }
        }
      } catch (error) {
        console.error(`Failed to parse transaction extraction result for chunk ${i + 1}:`, error);
        continue; // Skip this chunk and continue with others
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      continue; // Skip this chunk and continue with others
    }
  }
}

/**
 * Save transactions to database
 */
async function saveTransactionsToDatabase(transactions: TransactionRow[]): Promise<void> {
  const statementsToSave = transactions.map(t => ({
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    source: 'background_processed'
  }));
  
  await dbManager.saveStatements(statementsToSave);
}

/**
 * Clean up document chunks after processing
 */
async function cleanupDocumentChunks(filename: string): Promise<void> {
  try {
    await cleanupProcessedDocument(filename);
    console.log(`Cleaned up document chunks for ${filename}`);
  } catch (error) {
    console.error(`Error cleaning up chunks for ${filename}:`, error);
    // Don't throw error here to prevent job from failing if cleanup fails
    console.log(`Continuing despite cleanup error for ${filename}`);
  }
}

/**
 * Process a single job
 */
async function processJob(job: ProcessingJob): Promise<void> {
  console.log(`Processing job for ${job.filename}`);
  
  try {
    // Update status to processing
    await updateJobStatus(job.filename, 'processing');
    
    // Get all chunks for this document from the database
    const chunks = await getDocumentChunksForProcessing(job.filename);
    
    if (chunks.length === 0) {
      throw new Error(`No chunks found for file ${job.filename}`);
    }
    
    console.log(`Found ${chunks.length} chunks for ${job.filename}`);
    
    // Convert chunks to the format expected by extractTransactionsFromChunks
    const formattedChunks = chunks.map(chunk => ({
      text: chunk.text,
      score: 1.0, // All chunks are equally relevant since they're from the same document
      metadata: chunk.metadata
    }));
    
    // Extract transactions from chunks using the generator
    const transactionGenerator = extractTransactionsFromChunks(formattedChunks);
    let totalTransactions = 0;
    
    // Process transactions as they are yielded from each chunk
    for await (const chunkTransactions of transactionGenerator) {
      if (chunkTransactions.length > 0) {
        // Save transactions to database immediately after each chunk is processed
        await saveTransactionsToDatabase(chunkTransactions);
        totalTransactions += chunkTransactions.length;
        console.log(`Saved ${chunkTransactions.length} transactions from current chunk. Total so far: ${totalTransactions}`);
      }
    }
    
    if (totalTransactions === 0) {
      console.log(`No transactions extracted from ${job.filename}`);
    } else {
      console.log(`Successfully processed ${totalTransactions} transactions from ${job.filename}`);
    }
    
    // Clean up document chunks from database after successful processing
    await cleanupDocumentChunks(job.filename);
    
    // Update job status to completed
    await updateJobStatus(job.filename, 'completed');
    
  } catch (error) {
    console.error(`Error processing job for ${job.filename}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateJobStatus(job.filename, 'failed', errorMessage);
    throw error;
  }
}

/**
 * Process jobs with retry mechanism and exponential backoff
 */
export async function processAllPendingJobsWithRetry(): Promise<void> {
  // Initialize SSE broadcasting if not already done
  if (!broadcastJobUpdate || !broadcastAdminUpdate) {
    await initSSEBroadcasting();
  }

  console.log('Starting background processing with retry mechanism...');
  
  try {
    const pendingJobs = await getPendingJobs();
    
    if (pendingJobs.length === 0) {
      console.log('No pending jobs to process');
      return;
    }
    
    console.log(`Found ${pendingJobs.length} pending jobs`);
    
    // Sort jobs by retry count (process new jobs first, then retries)
    const sortedJobs = pendingJobs.sort((a, b) => {
      const aRetries = a.retryCount || 0;
      const bRetries = b.retryCount || 0;
      return aRetries - bRetries;
    });
    
    // Process jobs sequentially to avoid overwhelming the system
    for (const job of sortedJobs) {
      try {
        const retryCount = job.retryCount || 0;
        
        // Apply exponential backoff for retry jobs
        if (retryCount > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000); // Max 30 seconds
          console.log(`Applying backoff of ${backoffMs}ms for retry ${retryCount} of ${job.filename}`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
        
        await processJob(job);
      } catch (error) {
        console.error(`Failed to process job ${job.filename}:`, error);
        // The error handling and retry logic is now in updateJobStatus
      }
    }
    
    console.log('Completed background processing of all pending jobs');
  } catch (error) {
    console.error('Error in background processing:', error);
    throw error;
  }
}

/**
 * Force retry all failed jobs (manual trigger)
 */
export async function retryAllFailedJobs(): Promise<{ retried: number; skipped: number }> {
  console.log('Manually retrying all failed jobs...');
  
  try {
    const result = await dbManager.retryAllFailedJobs();
    console.log(`Retry operation completed: ${result.retried} jobs retried, ${result.skipped} jobs skipped`);
    
    // Process the newly retried jobs immediately
    if (result.retried > 0) {
      await processAllPendingJobsWithRetry();
    }
    
    return result;
  } catch (error) {
    console.error('Error retrying failed jobs:', error);
    throw error;
  }
}

/**
 * Get detailed retry status for all jobs
 */
export async function getJobRetryStatus(): Promise<{
  retryEligible: ProcessingJob[];
  maxRetriesExceeded: ProcessingJob[];
  totalFailed: number;
}> {
  const [retryEligible, allFailed] = await Promise.all([
    dbManager.getRetryEligibleJobs(),
    dbManager.getProcessingJobs({ status: 'failed' })
  ]);
  
  const maxRetriesExceeded = allFailed.filter(job => {
    const retryCount = job.retryCount || 0;
    const maxRetries = job.maxRetries || 3;
    return retryCount >= maxRetries;
  });
  
  return {
    retryEligible,
    maxRetriesExceeded,
    totalFailed: allFailed.length
  };
}

/**
 * Start background processing in intervals (legacy function - now uses retry mechanism)
 */
export function startBackgroundProcessor(intervalMinutes: number = 5): NodeJS.Timeout {
  console.log(`Starting background processor with ${intervalMinutes} minute intervals`);
  
  // Run immediately
  processAllPendingJobsWithRetry().catch((error: Error) => {
    console.error('Initial background processing failed:', error);
  });
  
  // Set up interval
  return setInterval(() => {
    processAllPendingJobsWithRetry().catch((error: Error) => {
      console.error('Background processing failed:', error);
    });
  }, intervalMinutes * 60 * 1000);
}

/**
 * Legacy function - maintains backward compatibility
 * @deprecated Use processAllPendingJobsWithRetry instead
 */
export async function processAllPendingJobs(): Promise<void> {
  console.warn('processAllPendingJobs is deprecated. Use processAllPendingJobsWithRetry instead.');
  return await processAllPendingJobsWithRetry();
}
