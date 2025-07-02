import { NextRequest, NextResponse } from "next/server";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { processAllPendingJobsWithRetry } from "@/utils/backgroundProcessor";

// Store active SSE connections for background process status
const sseConnections = new Map<string, WritableStreamDefaultWriter>();

async function openDatabase() {
  return await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });
}

async function getProcessingJobStatus(filename?: string) {
  const db = await openDatabase();
  try {
    // Create table if it doesn't exist
    await db.exec(`CREATE TABLE IF NOT EXISTS processing_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE,
      file_type TEXT,
      upload_date TEXT,
      status TEXT DEFAULT 'pending',
      total_chunks INTEGER,
      processed_at TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      retry_count INTEGER DEFAULT 0,
      last_retry_at DATETIME,
      max_retries INTEGER DEFAULT 3
    )`);

    let job = null;
    if (filename) {
      job = await db.get(`
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
        WHERE filename = ?
        ORDER BY created_at DESC
      `, [filename]);
    }
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
    return { job, jobs, summary };
  } finally {
    await db.close();
  }
}

// SSE handler for status requests
async function handleSSEStatusRequest(request: NextRequest, filename?: string) {
  const clientId = Math.random().toString(36).substring(7);
  
  // Create a TransformStream to handle the SSE connection
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // Store the connection
  sseConnections.set(clientId, writer);
  
  // SSE helper function
  const sendSSEMessage = async (data: any, event?: string) => {
    try {
      const message = `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
      await writer.write(new TextEncoder().encode(message));
    } catch (error) {
      console.error('Failed to send SSE message:', error);
      sseConnections.delete(clientId);
    }
  };

  // Send initial connection confirmation
  await sendSSEMessage({ 
    type: 'connected', 
    clientId,
    filename,
    timestamp: new Date().toISOString() 
  }, 'connection');


  // Function to check and send status updates
  const sendStatusUpdate = async () => {
    try {
      const { job, jobs, summary } = await getProcessingJobStatus(filename);
      if (filename) {
        // Send individual job status
        if (job) {
          await sendSSEMessage({
            type: 'job_status',
            job,
            message: "Job status retrieved successfully",
            timestamp: new Date().toISOString()
          }, 'status');
          // Stop sending updates if job is completed or failed
          if (job.status === 'completed' || job.status === 'failed') {
            await sendSSEMessage({
              type: 'job_finished',
              job,
              timestamp: new Date().toISOString()
            }, 'finished');
            // Close connection after a short delay
            setTimeout(() => {
              sseConnections.delete(clientId);
              writer.close();
            }, 5000);
            return false; // Stop polling
          }
        } else {
          await sendSSEMessage({
            type: 'job_not_found',
            filename,
            timestamp: new Date().toISOString()
          }, 'error');
        }
      } else {
        // Send full status summary
        await sendSSEMessage({
          type: 'status_summary',
          summary,
          jobs,
          message: "Background processing status retrieved successfully",
          timestamp: new Date().toISOString()
        }, 'status');
      }
      return true; // Continue polling
    } catch (error) {
      console.error('Error getting status:', error);
      await sendSSEMessage({
        type: 'error',
        error: 'Failed to get status update',
        timestamp: new Date().toISOString()
      }, 'error');
      return true; // Continue polling despite error
    }
  };

  // Send initial status immediately
  sendStatusUpdate();

  // Heartbeat interval to keep connection alive
  const heartbeatInterval = setInterval(() => {
    writer.write(new TextEncoder().encode(`event: heartbeat\ndata: {"ts": "${new Date().toISOString()}"}\n\n`));
  }, 15000); // every 15 seconds

  // Start periodic status updates
  const statusInterval = setInterval(async () => {
    const shouldContinue = await sendStatusUpdate();
    if (!shouldContinue) {
      clearInterval(statusInterval);
      clearInterval(heartbeatInterval);
    }
  }, 3000); // Check every 3 seconds

  // Handle client disconnect
  request.signal?.addEventListener('abort', () => {
    clearInterval(statusInterval);
    clearInterval(heartbeatInterval);
    sseConnections.delete(clientId);
    writer.close();
    console.log(`[SSE] Client ${clientId} disconnected (abort)`);
  });

  // Return SSE response
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Accept'
    },
  });
}

// Function to broadcast updates to all connected SSE clients
export function broadcastBackgroundProcessUpdate(filename?: string, jobData?: any) {
  sseConnections.forEach(async (writer, clientId) => {
    try {
      let eventData;
      
      if (filename && jobData) {
        // Broadcast specific job update
        eventData = {
          type: 'job_status',
          job: jobData,
          message: "Job status updated",
          timestamp: new Date().toISOString()
        };
      } else {
        // Broadcast general status update
        const { jobs, summary } = await getProcessingJobStatus();
        eventData = {
          type: 'status_summary',
          summary,
          jobs,
          message: "Background processing status updated",
          timestamp: new Date().toISOString()
        };
      }
      
      const message = `event: status\ndata: ${JSON.stringify(eventData)}\n\n`;
      await writer.write(new TextEncoder().encode(message));
    } catch (error) {
      console.error(`Failed to broadcast to client ${clientId}:`, error);
      sseConnections.delete(clientId);
    }
  });
}

// Function to get number of active SSE connections
export function getActiveSSEConnectionsCount(): number {
  return sseConnections.size;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const accept = request.headers.get('accept');
    const sseParam = searchParams.get('sse'); // Check for explicit SSE request

    if (action === 'status') {
      const filename = searchParams.get('filename') || undefined;
      
      // Check if client wants SSE (either via Accept header or sse parameter)
      if (accept === 'text/event-stream' || sseParam === 'true') {
        return handleSSEStatusRequest(request, filename);
      }
      
      // Regular JSON response for polling
      const { job, jobs, summary } = await getProcessingJobStatus(filename);
      if (filename) {
        return NextResponse.json({
          job,
          message: "Job status retrieved successfully"
        });
      }
      return NextResponse.json({
        summary,
        jobs,
        message: "Background processing status retrieved successfully"
      });
    }

    return NextResponse.json({
      error: "Invalid action. Use ?action=status to get processing status"
    }, { status: 400 });

  } catch (error: unknown) {
    console.error("Background processing API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to get background processing status: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'process') {
      // Trigger background processing manually
      console.log('Manual background processing triggered');
      
      // Process in background (don't await to avoid timeout)
      processAllPendingJobsWithRetry().catch(error => {
        console.error('Manual background processing failed:', error);
      });

      return NextResponse.json({
        message: "Background processing started. Check status using GET request with ?action=status"
      });
    }

    return NextResponse.json({
      error: "Invalid action. Use 'process' to trigger background processing"
    }, { status: 400 });

  } catch (error: unknown) {
    console.error("Background processing API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to trigger background processing: ${errorMessage}` },
      { status: 500 }
    );
  }
}
