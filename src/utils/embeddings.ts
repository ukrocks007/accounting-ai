import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from './modelUtils';
import { getActiveModelConfig } from '../constants/models';

// Types for better type safety
interface EmbeddingMetadata {
  filename: string;
  chunkIndex: number;
  totalChunks: number;
  fileType: string;
  uploadDate: string;
  text: string;
  [key: string]: string | number; // Index signature for Pinecone compatibility
}

interface EmbeddingVector {
  id: string;
  values: number[];
  metadata: EmbeddingMetadata;
}

interface SearchResult {
  text: string;
  score: number;
  metadata: EmbeddingMetadata;
}

// Cache for Pinecone client
let pineconeClient: Pinecone | null = null;

/**
 * Get or create Pinecone client with caching
 */
export function getPineconeClient(): Pinecone {
  // Return cached client if it exists
  if (pineconeClient) {
    return pineconeClient;
  }
  
  // Check if API key is available
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY environment variable is required');
  }
  
  try {
    // Initialize and cache the client
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    return pineconeClient;
  } catch (error) {
    console.error('Failed to initialize Pinecone client:', error);
    throw new Error(`Failed to initialize Pinecone client: ${error}`);
  }
}

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'accounting-documents';
const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 200;

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    filename: string;
    chunkIndex: number;
    totalChunks: number;
    fileType: string;
    uploadDate: string;
  };
}

/**
 * Split text into chunks for embedding
 */
export function splitTextIntoChunks(text: string, filename: string, fileType: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const words = text.split(/\s+/);
  const uploadDate = new Date().toISOString();
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
    
    if (testChunk.length > CHUNK_SIZE && currentChunk) {
      // Save current chunk
      chunks.push({
        id: `${filename}-chunk-${chunkIndex}`,
        text: currentChunk,
        metadata: {
          filename,
          chunkIndex,
          totalChunks: 0, // Will be updated later
          fileType,
          uploadDate,
        },
      });
      
      // Start new chunk with overlap
      const overlapWords = currentChunk.split(/\s+/).slice(-CHUNK_OVERLAP / 10); // Rough overlap
      currentChunk = `${overlapWords.join(' ')} ${word}`;
      chunkIndex++;
    } else {
      currentChunk = testChunk;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      id: `${filename}-chunk-${chunkIndex}`,
      text: currentChunk,
      metadata: {
        filename,
        chunkIndex,
        totalChunks: 0,
        fileType,
        uploadDate,
      },
    });
  }
  
  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });
  
  return chunks;
}

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(chunks: DocumentChunk[]): Promise<EmbeddingVector[]> {
  const config = getActiveModelConfig('embedding');
  console.log('Embedding config:', {
    model: config.model,
    provider: config.provider,
    endpoint: config.endpoint,
    hasCredential: !!config.credential,
    credentialLength: config.credential?.length || 0
  });
  
  if (!config.credential && config.provider !== 'ollama') {
    throw new Error('Model credential is required for generating embeddings');
  }
  
  const embeddings = [];
  
  for (const chunk of chunks) {
    try {
      const embeddingVector = await generateEmbedding(chunk.text, 'embedding');
      
      embeddings.push({
        id: chunk.id,
        values: embeddingVector,
        metadata: {
          ...chunk.metadata,
          text: chunk.text, // Store the actual text in metadata for retrieval
        },
      });
    } catch (error) {
      console.error(`Error generating embedding for chunk ${chunk.id}:`, error);
      throw error;
    }
  }
  
  return embeddings;
}

/**
 * Store embeddings in Pinecone
 */
export async function storeEmbeddings(embeddings: EmbeddingVector[]): Promise<void> {
  try {
    const pinecone = getPineconeClient();
    const index = pinecone.index(INDEX_NAME);
    
    // Upsert in batches of 100 (Pinecone recommended batch size)
    const batchSize = 100;
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize);
      await index.upsert(batch);
    }
    
    console.log(`Stored ${embeddings.length} embeddings in Pinecone`);
  } catch (error) {
    console.error('Error storing embeddings in Pinecone:', error);
    throw error;
  }
}

/**
 * Search for relevant chunks using query embedding
 */
export async function searchRelevantChunks(query: string, topK: number = 5): Promise<SearchResult[]> {
  try {
    const pinecone = getPineconeClient();
    
    // Generate embedding for the query using the universal system
    const queryEmbedding = await generateEmbedding(query, 'embedding');
    
    // Search in Pinecone
    const index = pinecone.index(INDEX_NAME);
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });
    
    return searchResults.matches?.map((match) => ({
      text: (match.metadata as EmbeddingMetadata)?.text || '',
      score: match.score || 0,
      metadata: match.metadata as EmbeddingMetadata,
    })) || [];
  } catch (error) {
    console.error('Error searching relevant chunks:', error);
    throw error;
  }
}

/**
 * Process and store document for RAG
 */
export async function processDocumentForRAG(
  text: string,
  filename: string,
  fileType: string
): Promise<{ stored: boolean; chunkCount: number }> {
  try {
    // Check if text exceeds threshold
    if (text.length <= 4096) {
      return { stored: false, chunkCount: 0 };
    }
    
    console.log(`Processing document ${filename} for RAG (${text.length} characters)`);
    
    // Split into chunks
    const chunks = splitTextIntoChunks(text, filename, fileType);
    console.log(`Created ${chunks.length} chunks for ${filename}`);
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);
    
    // Store in Pinecone
    await storeEmbeddings(embeddings);
    
    // Add background processing job
    const { addProcessingJob } = await import('./backgroundProcessor');
    await addProcessingJob(
      filename,
      fileType,
      new Date().toISOString(),
      chunks.length
    );
    
    return { stored: true, chunkCount: chunks.length };
  } catch (error) {
    console.error('Error processing document for RAG:', error);
    throw error;
  }
}

/**
 * Get relevant context for a chat query
 */
export async function getRelevantContext(query: string, maxChunks: number = 3): Promise<string> {
  try {
    const relevantChunks = await searchRelevantChunks(query, maxChunks);
    
    if (relevantChunks.length === 0) {
      return '';
    }
    
    // Combine the relevant chunks into context
    const context = relevantChunks
      .map((chunk, index) => `## Document Context ${index + 1} (Score: ${chunk.score.toFixed(3)}):\n${chunk.text}`)
      .join('\n\n');
    
    return context;
  } catch (error) {
    console.error('Error getting relevant context:', error);
    return '';
  }
}
