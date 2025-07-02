'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import JobStatusSSE from '@/app/components/JobStatusSSE';

export default function SSEDemo() {
  const [filename, setFilename] = useState('test-file.pdf');
  const [method, setMethod] = useState<'polling' | 'sse'>('sse');

  return (
    <>
      <Header title="SSE Demo" />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Real-time Updates Demo</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Job Status Updates</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-2">
                Test Filename:
              </label>
              <input
                id="filename"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a filename to monitor"
              />
            </div>
            
            <div>
              <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-2">
                Update Method:
              </label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'polling' | 'sse')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sse">Server-Sent Events (Real-time)</option>
                <option value="polling">Polling (Legacy)</option>
              </select>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <p><strong>SSE (Server-Sent Events):</strong> Real-time updates pushed from server to client</p>
            <p><strong>Polling:</strong> Client requests updates every few seconds</p>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Benefits of Real-time Updates:</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li><strong>Instant notifications:</strong> Know immediately when jobs complete or fail</li>
            <li><strong>Reduced server load:</strong> No constant polling requests</li>
            <li><strong>Better user experience:</strong> Real-time progress updates</li>
            <li><strong>Connection status:</strong> See when you're connected or disconnected</li>
            <li><strong>Automatic fallback:</strong> Falls back to polling if SSE fails</li>
          </ul>
        </div>
      </div>

      {/* Show the JobStatus component if filename is provided */}
      {filename && (
        <JobStatusSSE
          filename={filename}
          method={method}
          checkStatusEndpoint="/api/background-process?action=status"
        />
      )}
    </>
  );
}
