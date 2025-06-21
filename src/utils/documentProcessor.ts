/**
 * Document processing utilities without Pinecone
 * Handles chunking and storing documents directly in SQLite database
 */

import { dbManager } from '../lib/dbManager';

const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 200;

export interface DocumentChunk {
  text: string;
  chunkIndex: number;
  fileType: string;
  uploadDate: string;
}

/**
 * Split text into chunks for processing
 */
export function splitTextIntoChunks(
  text: string, 
  filename: string, 
  fileType: string,
  uploadDate: string
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const end = Math.min(i + CHUNK_SIZE, text.length);
    const chunkText = text.slice(i, end);
    
    // Skip chunks that are too small (except for the last chunk)
    if (chunkText.length < 100 && i + CHUNK_SIZE < text.length) {
      continue;
    }
    
    chunks.push({
      text: chunkText,
      chunkIndex: chunkIndex++,
      fileType,
      uploadDate
    });
  }

  return chunks;
}

/**
 * Process and store document for background processing (without RAG/Pinecone)
 */
export async function processDocumentForBackgroundProcessing(
  text: string,
  filename: string,
  fileType: string
): Promise<{ stored: boolean; chunkCount: number }> {
  try {
    // Check if text exceeds threshold
    if (text.length <= 4096) {
      return { stored: false, chunkCount: 0 };
    }

    console.log(`Processing document ${filename} for background processing (${text.length} characters)`);
    
    // Split into chunks
    const uploadDate = new Date().toISOString();
    const chunks = splitTextIntoChunks(text, filename, fileType, uploadDate);
    console.log(`Created ${chunks.length} chunks for ${filename}`);
    
    // Store chunks in database
    await dbManager.storeDocumentChunks(filename, chunks);
    
    // Add background processing job
    const { addProcessingJob } = await import('./backgroundProcessor');
    await addProcessingJob(
      filename,
      fileType,
      uploadDate,
      chunks.length
    );
    
    return { stored: true, chunkCount: chunks.length };
  } catch (error) {
    console.error('Error processing document for background processing:', error);
    throw error;
  }
}

/**
 * Get all chunks for a document (for background processing)
 */
export async function getDocumentChunksForProcessing(filename: string): Promise<Array<{
  text: string;
  chunkIndex: number;
  metadata: {
    filename: string;
    fileType: string;
    uploadDate: string;
    chunkIndex: number;
    totalChunks: number;
  };
}>> {
  try {
    const chunks = await dbManager.getDocumentChunks(filename);
    
    return chunks.map(chunk => ({
      text: chunk.textContent,
      chunkIndex: chunk.chunkIndex,
      metadata: {
        filename: chunk.filename,
        fileType: chunk.fileType,
        uploadDate: chunk.uploadDate,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunks.length
      }
    }));
  } catch (error) {
    console.error(`Error getting chunks for ${filename}:`, error);
    throw error;
  }
}

/**
 * Search for relevant content in stored chunks (simple text search without embeddings)
 */
export async function searchRelevantContent(
  query: string, 
  maxChunks: number = 5
): Promise<Array<{
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}>> {
  try {
    // This is a simplified search that looks for keyword matches
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    // Search chunks using DatabaseManager
    const matchingChunks = await dbManager.searchDocumentChunks(searchTerms);
    
    const scoredChunks = matchingChunks.map(chunk => {
      const text = chunk.textContent.toLowerCase();
      let score = 0;
      
      // Simple scoring based on term frequency
      searchTerms.forEach(term => {
        const matches = (text.match(new RegExp(term, 'g')) || []).length;
        score += matches;
      });
      
      return {
        text: chunk.textContent,
        score,
        metadata: {
          filename: chunk.filename,
          fileType: chunk.fileType,
          uploadDate: chunk.uploadDate,
          chunkIndex: chunk.chunkIndex
        }
      };
    }).filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks);
    
    return scoredChunks;
  } catch (error) {
    console.error('Error searching relevant content:', error);
    return [];
  }
}

/**
 * Get relevant context for a chat query (replacement for RAG search)
 */
export async function getRelevantContext(query: string, maxChunks: number = 3): Promise<string> {
  try {
    const relevantChunks = await searchRelevantContent(query, maxChunks);
    
    if (relevantChunks.length === 0) {
      return '';
    }
    
    const context = relevantChunks
      .map(chunk => `[From ${chunk.metadata.filename}]: ${chunk.text}`)
      .join('\n\n');
    
    return context;
  } catch (error) {
    console.error('Error getting relevant context:', error);
    return '';
  }
}

/**
 * Clean up chunks after successful processing
 */
export async function cleanupProcessedDocument(filename: string): Promise<void> {
  try {
    const deletedCount = await dbManager.deleteDocumentChunks(filename);
    console.log(`Cleaned up ${deletedCount} chunks for ${filename}`);
  } catch (error) {
    console.error(`Error cleaning up chunks for ${filename}:`, error);
    // Don't throw error here to prevent job from failing if cleanup fails
    console.log(`Continuing despite cleanup error for ${filename}`);
  }
}
