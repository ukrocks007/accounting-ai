import { startBackgroundProcessor } from '../utils/backgroundProcessor';
import { dbManager } from './dbManager';

// Global variable to store the background processor interval
declare global {
  // eslint-disable-next-line no-var
  var backgroundProcessorInterval: NodeJS.Timeout | undefined;
}

/**
 * Initialize background processor when server starts
 */
export async function initializeBackgroundProcessor() {
  try {
    // Initialize database tables first
    console.log('Initializing database tables...');
    await dbManager.initializeTables();
    console.log('Database tables initialized successfully');
    
    // Only start if not already running (prevents multiple intervals in development)
    if (!global.backgroundProcessorInterval) {
      console.log('Initializing background processor...');
      
      // Start background processor with 5-minute intervals
      global.backgroundProcessorInterval = startBackgroundProcessor(5);
      
      console.log('Background processor initialized successfully');
    } else {
      console.log('Background processor already running');
    }
  } catch (error) {
    console.error('Error initializing background processor:', error);
    throw error;
  }
}

/**
 * Stop background processor (useful for cleanup)
 */
export function stopBackgroundProcessor() {
  if (global.backgroundProcessorInterval) {
    clearInterval(global.backgroundProcessorInterval);
    global.backgroundProcessorInterval = undefined;
    console.log('Background processor stopped');
  }
}

// Note: Background processor needs to be manually initialized in production
// Call initializeBackgroundProcessor() when the server starts
