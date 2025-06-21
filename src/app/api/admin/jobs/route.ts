import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "../../../../lib/dbManager";
import { retryAllFailedJobs } from "../../../../utils/backgroundProcessor";

export async function POST(request: NextRequest) {
  try {
    const { action, filename, jobIds, maxRetries } = await request.json();

    switch (action) {
      case 'retry-single':
        if (!filename) {
          return NextResponse.json(
            { error: "Filename is required for retry-single action" },
            { status: 400 }
          );
        }
        
        const success = await dbManager.retryProcessingJob(filename);
        return NextResponse.json({
          success,
          message: success 
            ? `Job ${filename} has been queued for retry`
            : `Could not retry job ${filename} (may not exist, not failed, or exceeded max retries)`
        });

      case 'retry-all':
        const result = await retryAllFailedJobs();
        return NextResponse.json({
          success: true,
          message: `Retry operation completed: ${result.retried} jobs retried, ${result.skipped} jobs skipped`,
          retried: result.retried,
          skipped: result.skipped
        });

      case 'retry-selected':
        if (!jobIds || !Array.isArray(jobIds)) {
          return NextResponse.json(
            { error: "Job IDs array is required for retry-selected action" },
            { status: 400 }
          );
        }
        
        let retried = 0;
        let skipped = 0;
        
        for (const jobId of jobIds) {
          const success = await dbManager.retryProcessingJob(jobId);
          if (success) {
            retried++;
          } else {
            skipped++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Selected retry operation completed: ${retried} jobs retried, ${skipped} jobs skipped`,
          retried,
          skipped
        });

      case 'delete-job':
        if (!filename) {
          return NextResponse.json(
            { error: "Filename is required for delete-job action" },
            { status: 400 }
          );
        }
        
        // Check if job exists and get its status
        const jobs = await dbManager.getProcessingJobs({ filename });
        const job = jobs.find(j => j.filename === filename);
        
        if (!job) {
          return NextResponse.json(
            { error: "Job not found" },
            { status: 404 }
          );
        }
        
        if (job.status === 'processing') {
          return NextResponse.json(
            { error: "Cannot delete job that is currently processing" },
            { status: 400 }
          );
        }
        
        const deletedCount = await dbManager.deleteProcessingJobs({ filename });
        
        return NextResponse.json({
          success: deletedCount > 0,
          message: deletedCount > 0 
            ? `Job ${filename} has been deleted`
            : `Job ${filename} was not found or could not be deleted`
        });

      case 'set-max-retries':
        if (!filename || maxRetries === undefined) {
          return NextResponse.json(
            { error: "Filename and maxRetries are required for set-max-retries action" },
            { status: 400 }
          );
        }
        
        if (typeof maxRetries !== 'number' || maxRetries < 0 || maxRetries > 10) {
          return NextResponse.json(
            { error: "maxRetries must be a number between 0 and 10" },
            { status: 400 }
          );
        }
        
        await dbManager.setJobMaxRetries(filename, maxRetries);
        return NextResponse.json({
          success: true,
          message: `Set max retries for ${filename} to ${maxRetries}`
        });

      default:
        return NextResponse.json(
          { error: "Invalid action. Supported actions: retry-single, retry-all, retry-selected, delete-job, set-max-retries" },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("Error in admin job operation:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'failed-jobs':
        const failedJobs = await dbManager.getProcessingJobs({ status: 'failed' });
        
        return NextResponse.json({
          success: true,
          data: failedJobs
        });

      case 'retry-eligible':
        const eligibleJobs = await dbManager.getRetryEligibleJobs();
        return NextResponse.json({
          success: true,
          data: eligibleJobs
        });

      default:
        return NextResponse.json(
          { error: "Invalid action. Supported actions: failed-jobs, retry-eligible" },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("Error getting admin job information:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
