import { NextRequest, NextResponse } from "next/server";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { processAllPendingJobs } from "@/utils/backgroundProcessor";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');


    if (action === 'status') {
      const filename = searchParams.get('filename') || undefined;
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
      processAllPendingJobs().catch(error => {
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
