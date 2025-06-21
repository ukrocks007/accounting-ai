'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';

interface ProcessingJob {
  filename: string;
  file_type: string;
  status: string;
  total_chunks: number;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  status_description: string;
  retry_count?: number;
  max_retries?: number;
}

interface ProcessingSummary {
  total_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
}

interface RetryStatus {
  totalFailed: number;
  retryEligible: number;
  maxRetriesExceeded: number;
  retryEligibleJobs: ProcessingJob[];
  maxRetriesExceededJobs: ProcessingJob[];
}

export default function BackgroundProcessingAdmin() {
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [retryStatus, setRetryStatus] = useState<RetryStatus | null>(null);
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/background-process?action=status');
      const data = await response.json();
      
      if (response.ok) {
        setSummary(data.summary);
        setJobs(data.jobs);
      } else {
        console.error('Failed to fetch status:', data.error);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRetryStatus = async () => {
    try {
      const response = await fetch('/api/jobs/retry?action=status');
      const data = await response.json();
      
      if (response.ok) {
        setRetryStatus(data.data);
      } else {
        console.error('Failed to fetch retry status:', data.error);
      }
    } catch (error) {
      console.error('Error fetching retry status:', error);
    }
  };

  const triggerProcessing = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/background-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'process' }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Background processing triggered successfully!');
        // Refresh status after a short delay
        setTimeout(() => {
          fetchStatus();
        }, 2000);
      } else {
        alert(`Failed to trigger processing: ${data.error}`);
      }
    } catch (error) {
      alert(`Error triggering processing: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const retryJob = async (filename: string) => {
    setRetryingJobs(prev => new Set(prev).add(filename));
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry-single', filename }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        fetchStatus();
        fetchRetryStatus();
      } else {
        alert(`Failed to retry job: ${data.error}`);
      }
    } catch (error) {
      alert(`Error retrying job: ${error}`);
    } finally {
      setRetryingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  const retryAllFailedJobs = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry-all' }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Retry completed: ${data.retried} jobs retried, ${data.skipped} jobs skipped`);
        fetchStatus();
        fetchRetryStatus();
      } else {
        alert(`Failed to retry jobs: ${data.error}`);
      }
    } catch (error) {
      alert(`Error retrying jobs: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const deleteJob = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete the job "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'delete-job', filename }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        fetchStatus();
        fetchRetryStatus();
      } else {
        alert(`Failed to delete job: ${data.error}`);
      }
    } catch (error) {
      alert(`Error deleting job: ${error}`);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRetryStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchRetryStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Background Processing Administration"
        description="Monitor and manage background document processing jobs"
      />
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="space-x-4">
              <button
                onClick={fetchStatus}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh Status
              </button>
              <button
                onClick={triggerProcessing}
                disabled={processing}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Trigger Processing'}
              </button>
              {retryStatus && retryStatus.retryEligible > 0 && (
                <button
                  onClick={retryAllFailedJobs}
                  disabled={processing}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                >
                  {processing ? 'Retrying...' : `Retry All Failed (${retryStatus.retryEligible})`}
                </button>
              )}
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-100 p-4 rounded">
                <div className="text-2xl font-bold text-gray-900">{summary.total_jobs}</div>
                <div className="text-sm text-gray-600">Total Jobs</div>
              </div>
              <div className="bg-yellow-100 p-4 rounded">
                <div className="text-2xl font-bold text-yellow-800">{summary.pending_jobs}</div>
                <div className="text-sm text-yellow-600">Pending</div>
              </div>
              <div className="bg-blue-100 p-4 rounded">
                <div className="text-2xl font-bold text-blue-800">{summary.processing_jobs}</div>
                <div className="text-sm text-blue-600">Processing</div>
              </div>
              <div className="bg-green-100 p-4 rounded">
                <div className="text-2xl font-bold text-green-800">{summary.completed_jobs}</div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
              <div className="bg-red-100 p-4 rounded">
                <div className="text-2xl font-bold text-red-800">{summary.failed_jobs}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>
          )}

          {retryStatus && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-orange-800 mb-2">Retry Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-orange-700">Total Failed:</span> {retryStatus.totalFailed}
                </div>
                <div>
                  <span className="font-medium text-orange-700">Retry Eligible:</span> {retryStatus.retryEligible}
                </div>
                <div>
                  <span className="font-medium text-orange-700">Max Retries Exceeded:</span> {retryStatus.maxRetriesExceeded}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Filename</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Chunks</th>
                  <th className="text-left py-3 px-4">Created</th>
                  <th className="text-left py-3 px-4">Processed</th>
                  <th className="text-left py-3 px-4">Description</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{job.filename}</td>
                    <td className="py-3 px-4">{job.file_type}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                      {job.retry_count !== undefined && job.retry_count > 0 && (
                        <span className="ml-2 text-xs text-gray-500">
                          (Retry {job.retry_count}/{job.max_retries || 3})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">{job.total_chunks}</td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {job.processed_at ? new Date(job.processed_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {job.error_message ? (
                        <span className="text-red-600">{job.error_message}</span>
                      ) : (
                        job.status_description
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        {job.status === 'failed' && (
                          <>
                            <button
                              onClick={() => retryJob(job.filename)}
                              disabled={retryingJobs.has(job.filename)}
                              className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 disabled:opacity-50"
                            >
                              {retryingJobs.has(job.filename) ? 'Retrying...' : 'Retry'}
                            </button>
                            <button
                              onClick={() => deleteJob(job.filename)}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {job.status === 'completed' && (
                          <button
                            onClick={() => deleteJob(job.filename)}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            Delete
                          </button>
                        )}
                        {job.status === 'pending' && (
                          <span className="text-gray-500 text-xs">
                            Waiting to process
                          </span>
                        )}
                        {job.status === 'processing' && (
                          <span className="text-blue-500 text-xs">
                            Currently processing...
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {jobs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No processing jobs found
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">How it works</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• When large documents (&gt;4KB) are uploaded, they are split into chunks and stored in the database</p>
            <p>• Background processor runs every 5 minutes to process pending jobs</p>
            <p>• Each job retrieves document chunks from the database and extracts transactions using LLM</p>
            <p>• Extracted transactions are saved to SQLite database</p>
            <p>• After successful processing, chunks are removed from the database to save storage</p>
            <p>• You can manually trigger processing using the button above</p>
            <p>• <strong>Retry functionality:</strong> Failed jobs can be retried individually or in bulk (up to 3 times by default)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
