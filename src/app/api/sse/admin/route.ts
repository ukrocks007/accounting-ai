import { NextRequest } from "next/server";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Store active SSE connections for admin
const adminConnections = new Map<string, WritableStreamDefaultWriter>();

async function openDatabase() {
  return await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });
}

async function getFullStatus() {
  const db = await openDatabase();
  try {
    const jobs = await db.all(`
      SELECT 
        filename, file_type, status, total_chunks, 
        processed_at, error_message, created_at,
        retry_count, max_retries,
        CASE 
          WHEN status = 'completed' THEN 'Processed and saved to database'
          WHEN status = 'failed' THEN error_message
          WHEN status = 'processing' THEN 'Currently processing...'
          ELSE 'Waiting in queue'
        END as status_description
      FROM processing_jobs 
      ORDER BY created_at DESC
    `);
    
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs
      FROM processing_jobs
    `);
    
    return { jobs, summary };
  } finally {
    await db.close();
  }
}

export async function GET(request: NextRequest) {
  const clientId = Math.random().toString(36).substring(7);
  
  // Create a TransformStream to handle the SSE connection
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // Store the connection
  adminConnections.set(clientId, writer);
  
  // SSE helper function
  const sendSSEMessage = async (data: any, event?: string) => {
    try {
      const message = `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
      await writer.write(new TextEncoder().encode(message));
    } catch (error) {
      console.error('Failed to send SSE message:', error);
      adminConnections.delete(clientId);
    }
  };

  // Send initial connection confirmation
  await sendSSEMessage({ 
    type: 'connected', 
    clientId,
    timestamp: new Date().toISOString() 
  }, 'connection');

  // Function to check and send status updates
  const sendStatusUpdate = async () => {
    try {
      const { jobs, summary } = await getFullStatus();
      
      await sendSSEMessage({
        type: 'status_update',
        jobs,
        summary,
        timestamp: new Date().toISOString()
      }, 'status_update');
      
    } catch (error) {
      console.error('Error getting status:', error);
      await sendSSEMessage({
        type: 'error',
        error: 'Failed to get status update',
        timestamp: new Date().toISOString()
      }, 'error');
    }
  };

  // Send initial status immediately
  sendStatusUpdate();

  // Start periodic status updates
  const statusInterval = setInterval(sendStatusUpdate, 5000); // Update every 5 seconds

  // Handle client disconnect
  request.signal?.addEventListener('abort', () => {
    clearInterval(statusInterval);
    adminConnections.delete(clientId);
    writer.close();
  });

  // Return SSE response
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    },
  });
}

// Function to broadcast updates to all connected admin clients
export function broadcastAdminUpdate() {
  adminConnections.forEach(async (writer, clientId) => {
    try {
      const { jobs, summary } = await getFullStatus();
      
      const message = `event: status_update\ndata: ${JSON.stringify({
        type: 'status_update',
        jobs,
        summary,
        timestamp: new Date().toISOString()
      })}\n\n`;
      
      await writer.write(new TextEncoder().encode(message));
    } catch (error) {
      console.error(`Failed to broadcast to admin client ${clientId}:`, error);
      adminConnections.delete(clientId);
    }
  });
}

// Function to get number of active admin connections
export function getActiveAdminConnectionsCount(): number {
  return adminConnections.size;
}
