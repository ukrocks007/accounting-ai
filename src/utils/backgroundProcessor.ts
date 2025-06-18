import { getDocumentChunksForProcessing, cleanupProcessedDocument } from './documentProcessor';
import { createModelClient, getModelRequestParams } from './modelUtils';
import { isUnexpected } from "@azure-rest/ai-inference";
import { jsonrepair } from "jsonrepair";
import { dbManager, StatementRow, ProcessingJob as DBProcessingJob } from '../lib/dbManager';

// Interface for transaction data (alias for StatementRow)
interface TransactionRow extends StatementRow {}

// Interface for processing job (alias for imported type)
interface ProcessingJob extends DBProcessingJob {}

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
 * Update job status with retry handling
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
      return; // Don't mark as failed, it's been reset to pending
    }
  }
  
  // If not retrying or if it's not a failure, update normally
  await dbManager.updateProcessingJobStatus(filename, status, errorMessage);
}

/**
 * Extract transactions from document chunks using LLM
 */
async function extractTransactionsFromChunks(
  chunks: Array<{ text: string; score: number; metadata: any }>
): Promise<TransactionRow[]> {
  // Combine all chunk texts into a single document
  const combinedText = chunks
    .map(chunk => chunk.text)
    .join('\n\n---\n\n');

  const client = createModelClient('upload');
  const modelParams = getModelRequestParams('upload');

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant. Process the financial document content and extract transactions. 

Make sure you only return the transactions in JSON format and nothing else. Look for information that represents:
- Date (various formats like MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- Description/Transaction details/Memo
- Amount (positive or negative numbers, or separate debit/credit columns)
- Transaction type (debit/credit, or infer from amount sign)

In case you are not able to give a response, return an empty array. Extract as many valid transactions as you can find.

The return JSON looks like this:
{
  "overflow": false,
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
- Only extract clear, valid transactions - skip headers, summaries, or unclear entries`,
        },
        {
          role: "user",
          content: `Please extract transactions from this financial document:\n\n${combinedText}`,
        },
      ],
      ...modelParams,
    },
  });

  if (isUnexpected(response)) {
    throw new Error(`LLM API error: ${response.body.error}`);
  }

  const result = response.body.choices[0].message.content;

  try {
    const repairedJson = jsonrepair(result || "");
    const parsedResult = JSON.parse(repairedJson);

    if (parsedResult?.rows && Array.isArray(parsedResult.rows)) {
      // Validate and clean up the extracted transactions
      return parsedResult.rows
        .filter((row: any) => 
          row.date && row.description && typeof row.amount === 'number'
        )
        .map((row: any) => ({
          ...row,
          type: row.type || 'debit' // Default to 'debit' if type is missing
        }));
    }
    
    return [];
  } catch (error) {
    console.error("Failed to parse transaction extraction result:", error);
    return [];
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
    
    // Extract transactions from chunks
    const transactions = await extractTransactionsFromChunks(formattedChunks);
    
    if (transactions.length === 0) {
      console.log(`No transactions extracted from ${job.filename}`);
    } else {
      // Save transactions to database
      await saveTransactionsToDatabase(transactions);
      console.log(`Successfully processed ${transactions.length} transactions from ${job.filename}`);
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
  processAllPendingJobsWithRetry().catch((error: any) => {
    console.error('Initial background processing failed:', error);
  });
  
  // Set up interval
  return setInterval(() => {
    processAllPendingJobsWithRetry().catch((error: any) => {
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
