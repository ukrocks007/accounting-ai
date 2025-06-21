import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "../../../../lib/dbManager";
import { retryAllFailedJobs, getJobRetryStatus } from "../../../../utils/backgroundProcessor";

export async function POST(request: NextRequest) {
  try {
    const { action, filename, maxRetries } = await request.json();

    switch (action) {
      case 'retry-all':
        const result = await retryAllFailedJobs();
        return NextResponse.json({
          success: true,
          message: `Retry operation completed: ${result.retried} jobs retried, ${result.skipped} jobs skipped`,
          retried: result.retried,
          skipped: result.skipped
        });

      case 'retry-job':
        if (!filename) {
          return NextResponse.json(
            { error: "Filename is required for retry-job action" },
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

      case 'set-max-retries':
        if (!filename || maxRetries === undefined) {
          return NextResponse.json(
            { error: "Filename and maxRetries are required for set-max-retries action" },
            { status: 400 }
          );
        }
        
        if (typeof maxRetries !== 'number' || maxRetries < 0) {
          return NextResponse.json(
            { error: "maxRetries must be a positive number" },
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
          { error: "Invalid action. Supported actions: retry-all, retry-job, set-max-retries" },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("Error in retry operation:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'status':
        const status = await getJobRetryStatus();
        return NextResponse.json({
          success: true,
          data: {
            totalFailed: status.totalFailed,
            retryEligible: status.retryEligible.length,
            maxRetriesExceeded: status.maxRetriesExceeded.length,
            retryEligibleJobs: status.retryEligible,
            maxRetriesExceededJobs: status.maxRetriesExceeded
          }
        });

      case 'eligible':
        const eligibleJobs = await dbManager.getRetryEligibleJobs();
        return NextResponse.json({
          success: true,
          data: eligibleJobs
        });

      default:
        // Default: return all processing jobs with retry info
        const allJobs = await dbManager.getProcessingJobs();
        return NextResponse.json({
          success: true,
          data: allJobs
        });
    }
  } catch (error: unknown) {
    console.error("Error getting retry information:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
