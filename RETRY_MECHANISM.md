# Retry Mechanism Documentation

## Overview

The enhanced Database Manager now includes a robust retry mechanism for failed processing jobs. This system automatically handles job failures with intelligent retry logic, exponential backoff, and comprehensive tracking.

## Features

### 🔄 Automatic Retry System
- **Configurable Max Retries**: Default 3 attempts per job, configurable per job
- **Exponential Backoff**: Intelligent delay between retry attempts (1s, 2s, 4s, max 30s)
- **Automatic Queuing**: Failed jobs are automatically retried if they haven't exceeded max attempts
- **Retry Tracking**: Full history of retry attempts with timestamps and error messages

### 📊 Enhanced Monitoring
- **Retry Status Tracking**: Monitor retry counts, eligibility, and exceeded limits
- **Detailed Statistics**: Enhanced stats include retry-specific metrics
- **Comprehensive Logging**: Detailed logs for all retry operations

### 🛠 Management Tools
- **CLI Utilities**: Command-line tools for managing retries
- **API Endpoints**: REST API for retry operations
- **Manual Control**: Force retry specific jobs or all eligible jobs

## Database Schema Changes

### Processing Jobs Table Updates
```sql
-- New columns added:
retry_count INTEGER DEFAULT 0,           -- Current retry attempt count
last_retry_at TEXT,                     -- Timestamp of last retry attempt
max_retries INTEGER DEFAULT 3           -- Maximum retry attempts allowed
```

## API Reference

### Database Manager Methods

#### `retryProcessingJob(filename: string): Promise<boolean>`
Retry a specific failed job if it hasn't exceeded max retries.

```typescript
const success = await dbManager.retryProcessingJob('invoice_2024.pdf');
if (success) {
  console.log('Job queued for retry');
} else {
  console.log('Job cannot be retried (max retries exceeded or not failed)');
}
```

#### `retryAllFailedJobs(): Promise<{retried: number; skipped: number}>`
Retry all eligible failed jobs.

```typescript
const result = await dbManager.retryAllFailedJobs();
console.log(`${result.retried} jobs retried, ${result.skipped} jobs skipped`);
```

#### `getRetryEligibleJobs(): Promise<ProcessingJob[]>`
Get all failed jobs that can still be retried.

```typescript
const eligibleJobs = await dbManager.getRetryEligibleJobs();
eligibleJobs.forEach(job => {
  console.log(`${job.filename}: ${job.retryCount}/${job.maxRetries} attempts`);
});
```

#### `setJobMaxRetries(filename: string, maxRetries: number): Promise<void>`
Set maximum retry attempts for a specific job.

```typescript
await dbManager.setJobMaxRetries('difficult_file.pdf', 5);
```

### Background Processor Functions

#### `processAllPendingJobsWithRetry(): Promise<void>`
Enhanced processing function with retry logic and exponential backoff.

#### `retryAllFailedJobs(): Promise<{retried: number; skipped: number}>`
Force retry all eligible failed jobs and process them immediately.

#### `getJobRetryStatus(): Promise<RetryStatus>`
Get comprehensive retry status information.

```typescript
const status = await getJobRetryStatus();
console.log(`${status.retryEligible.length} jobs can be retried`);
console.log(`${status.maxRetriesExceeded.length} jobs exceeded max retries`);
```

## Command Line Usage

### Basic Retry Operations
```bash
# Retry all failed jobs
npm run db:retry

# Show detailed retry status
npm run db:job-status

# Retry a specific job
npm run db retry-job invoice_2024.pdf

# Set max retries for a job
npm run db set-max-retries invoice_2024.pdf 5

# List jobs with retry information
npm run db list-jobs failed
```

### Advanced Operations
```bash
# Show comprehensive statistics (includes retry info)
npm run db:stats

# Test the retry system
npm run db:test

# Export retry-eligible jobs
npm run db export-statements retry_eligible.json
```

## REST API Endpoints

### POST `/api/jobs/retry`

#### Retry All Failed Jobs
```json
{
  "action": "retry-all"
}
```

Response:
```json
{
  "success": true,
  "message": "Retry operation completed: 3 jobs retried, 1 jobs skipped",
  "retried": 3,
  "skipped": 1
}
```

#### Retry Specific Job
```json
{
  "action": "retry-job",
  "filename": "invoice_2024.pdf"
}
```

#### Set Max Retries
```json
{
  "action": "set-max-retries",
  "filename": "difficult_file.pdf",
  "maxRetries": 5
}
```

### GET `/api/jobs/retry`

#### Get Retry Status
```
GET /api/jobs/retry?action=status
```

Response:
```json
{
  "success": true,
  "data": {
    "totalFailed": 4,
    "retryEligible": 3,
    "maxRetriesExceeded": 1,
    "retryEligibleJobs": [...],
    "maxRetriesExceededJobs": [...]
  }
}
```

#### Get Retry Eligible Jobs
```
GET /api/jobs/retry?action=eligible
```

## Retry Logic Flow

### 1. Job Failure Detection
```typescript
// When a job fails, the system checks if it can be retried
if (status === 'failed') {
  const retrySuccess = await dbManager.retryProcessingJob(filename);
  if (retrySuccess) {
    console.log('Job automatically queued for retry');
    return; // Don't mark as failed, it's been reset to pending
  }
}
```

### 2. Exponential Backoff
```typescript
// Apply exponential backoff for retry jobs
if (retryCount > 0) {
  const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
  await new Promise(resolve => setTimeout(resolve, backoffMs));
}
```

### 3. Retry Eligibility Check
```typescript
// Check if job can be retried
const currentRetries = job.retry_count || 0;
const maxRetries = job.max_retries || 3;

if (currentRetries >= maxRetries) {
  return false; // Cannot retry
}
```

## Configuration Options

### Default Settings
- **Max Retries**: 3 attempts per job
- **Backoff Strategy**: Exponential (1s, 2s, 4s, 8s, 16s, 30s max)
- **Processing Interval**: 5 minutes
- **Auto-Retry**: Enabled by default

### Customization
```typescript
// Set custom max retries for specific job types
await dbManager.setJobMaxRetries('large_file.pdf', 5);

// Configure backoff in background processor
const customBackoffMs = Math.min(2000 * Math.pow(1.5, retryCount - 1), 60000);
```

## Monitoring and Alerting

### Statistics Tracking
```typescript
const stats = await dbManager.getStatistics();
console.log(`Retry eligible: ${stats.retryEligibleJobsCount}`);
console.log(`Max retries exceeded: ${stats.maxRetriesExceededCount}`);
```

### Log Messages
- ✅ `Job automatically queued for retry`
- 🔄 `Retrying job filename (attempt 2/3)`
- ⏰ `Applying backoff of 4000ms for retry 2`
- ⛔ `Job has exceeded max retries (3/3)`

## Best Practices

### 1. Set Appropriate Max Retries
```typescript
// For critical documents
await dbManager.setJobMaxRetries('important_invoice.pdf', 5);

// For test files
await dbManager.setJobMaxRetries('test_file.pdf', 1);
```

### 2. Monitor Retry Status Regularly
```bash
# Daily monitoring
npm run db:job-status

# Check for jobs that need attention
npm run db list-jobs failed
```

### 3. Handle Max Retries Exceeded
```typescript
const status = await getJobRetryStatus();
if (status.maxRetriesExceeded.length > 0) {
  // Alert administrators
  // Manual intervention may be required
}
```

### 4. Use Appropriate Backoff
- Short delays for temporary issues (network, rate limits)
- Longer delays for resource constraints
- Maximum cap to prevent excessive delays

## Troubleshooting

### Common Issues

#### Jobs Not Retrying
1. Check if max retries exceeded: `npm run db job-status`
2. Verify job is in 'failed' status: `npm run db list-jobs failed`
3. Check logs for retry eligibility messages

#### Excessive Retries
1. Review error messages: `npm run db list-jobs failed`
2. Adjust max retries if needed: `npm run db set-max-retries <file> <count>`
3. Check for systematic issues causing failures

#### Performance Issues
1. Monitor backoff delays in logs
2. Consider reducing retry frequency for large batches
3. Use `processAllPendingJobsWithRetry()` instead of legacy function

### Debug Commands
```bash
# Detailed job information
npm run db list-jobs

# Retry status overview
npm run db job-status

# Test retry system
npm run db:test

# Force retry all (use carefully)
npm run db retry-failed
```

## Migration Guide

### From Legacy System
The retry mechanism is automatically enabled for new installations. For existing databases:

1. **Run Migration**: `npm run db:migrate`
2. **Initialize New Columns**: `npm run db:init`
3. **Test System**: `npm run db:test`
4. **Update Code**: Replace `processAllPendingJobs()` with `processAllPendingJobsWithRetry()`

### Breaking Changes
- ProcessingJob interface now includes retry fields
- Background processor uses exponential backoff
- Failed jobs may automatically retry instead of staying failed

## Future Enhancements

### Planned Features
- **Custom Backoff Strategies**: Configurable backoff algorithms
- **Retry Webhooks**: Notifications for retry events
- **Job Prioritization**: Priority queuing for important jobs
- **Batch Retry Operations**: Efficient bulk retry operations
- **Retry Analytics**: Detailed retry success/failure analytics

### Integration Points
- **Monitoring Systems**: Export metrics to monitoring platforms
- **Alert Systems**: Integration with notification services
- **Dashboard UI**: Web interface for retry management
- **Automated Policies**: Rule-based retry configuration

This retry mechanism provides a robust foundation for handling processing failures while maintaining system stability and providing comprehensive monitoring capabilities.
