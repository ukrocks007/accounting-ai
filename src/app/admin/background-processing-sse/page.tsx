'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';

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

export default function BackgroundProcessingAdminSSE() {
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [useSSE, setUseSSE] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  
  // SSE connection
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

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

  const connectSSE = () => {
    if (eventSource) {
      eventSource.close();
    }

    setConnectionStatus('connecting');
    
    const es = new EventSource('/api/sse/admin');
    setEventSource(es);

    es.onopen = () => {
      setConnectionStatus('connected');
      console.log('SSE connected for admin panel');
    };

    es.addEventListener('status_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.summary && data.jobs) {
          setSummary(data.summary);
          setJobs(data.jobs);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    es.onerror = (error) => {
      console.error('SSE Error:', error);
      setConnectionStatus('error');
      
      // Fallback to polling
      setTimeout(() => {
        if (useSSE) {
          connectSSE();
        }
      }, 5000);
    };

    es.addEventListener('close', () => {
      setConnectionStatus('disconnected');
    });
  };

  const disconnectSSE = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setConnectionStatus('disconnected');
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
        if (!useSSE) {
          // Only manually refresh if not using SSE
          setTimeout(() => {
            fetchStatus();
          }, 2000);
        }
      } else {
        alert(`Failed to trigger processing: ${data.error}`);
      }
    } catch (error) {
      alert(`Error triggering processing: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleConnectionMethod = () => {
    if (useSSE) {
      // Switch to polling
      disconnectSSE();
      setUseSSE(false);
      fetchStatus();
      
      // Start polling interval
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    } else {
      // Switch to SSE
      setUseSSE(true);
      connectSSE();
    }
  };

  useEffect(() => {
    if (useSSE) {
      connectSSE();
    } else {
      fetchStatus();
      
      // Polling fallback
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }

    return () => {
      disconnectSSE();
    };
  }, [useSSE]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSSE();
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const ConnectionIndicator = () => {
    if (!useSSE) {
      return (
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm">Polling mode</span>
        </div>
      );
    }

    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <Wifi className="w-4 h-4" />
            <span className="text-sm">Real-time connected</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Connecting...</span>
          </div>
        );
      case 'error':
      case 'disconnected':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">Disconnected (retrying...)</span>
          </div>
        );
    }
  };

  return (
    <>
      <Header title="Background Processing Admin" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Background Processing Admin (SSE)</h1>
          <div className="flex items-center gap-4">
            <ConnectionIndicator />
            <button
              onClick={toggleConnectionMethod}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Switch to {useSSE ? 'Polling' : 'Real-time'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-600">Total Jobs</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.total_jobs}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-600">Pending</h3>
              <p className="text-2xl font-bold text-yellow-600">{summary.pending_jobs}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-600">Processing</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.processing_jobs}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-600">Completed</h3>
              <p className="text-2xl font-bold text-green-600">{summary.completed_jobs}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-lg font-semibold text-gray-600">Failed</h3>
              <p className="text-2xl font-bold text-red-600">{summary.failed_jobs}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6">
          <button
            onClick={triggerProcessing}
            disabled={processing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {processing ? 'Processing...' : 'Trigger Processing'}
          </button>
        </div>

        {/* Jobs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Processing Jobs</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No jobs found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job, index) => (
                    <tr key={`${job.filename}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {job.filename}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.file_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        {job.error_message && (
                          <div className="text-xs text-red-600 mt-1">
                            {job.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.processed_at ? formatDate(job.processed_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
