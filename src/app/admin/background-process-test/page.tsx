'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import JobStatus from '@/app/components/JobStatus';

export default function BackgroundProcessSSETest() {
  const [filename, setFilename] = useState('test-document.pdf');
  const [method, setMethod] = useState<'polling' | 'sse'>('sse');
  const [showJobStatus, setShowJobStatus] = useState(true);

  return (
    <>
      <Header title="Background Process SSE Test" />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Test Background Process with SSE</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Configure Test Parameters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                placeholder="Enter filename to monitor"
              />
            </div>
            
            <div>
              <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-2">
                Connection Method:
              </label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'polling' | 'sse')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sse">Server-Sent Events</option>
                <option value="polling">Traditional Polling</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="show" className="block text-sm font-medium text-gray-700 mb-2">
                Show Job Status:
              </label>
              <button
                onClick={() => setShowJobStatus(!showJobStatus)}
                className={`w-full px-3 py-2 rounded-md transition-colors ${
                  showJobStatus 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                {showJobStatus ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Current Configuration:</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li>Filename: <code className="bg-gray-100 px-1 rounded">{filename}</code></li>
              <li>Method: <code className="bg-gray-100 px-1 rounded">{method}</code></li>
              <li>Endpoint: <code className="bg-gray-100 px-1 rounded">/api/background-process?action=status</code></li>
              <li>Status: <code className="bg-gray-100 px-1 rounded">{showJobStatus ? 'Monitoring' : 'Stopped'}</code></li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">How to Test:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Open the browser's Developer Tools (F12)</li>
            <li>Go to the Network tab</li>
            <li>Watch the requests when using different methods:</li>
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li><strong>SSE:</strong> You should see one persistent connection to the background-process endpoint</li>
              <li><strong>Polling:</strong> You should see repeated requests every few seconds</li>
            </ul>
            <li>Switch between methods to see the difference in network behavior</li>
            <li>Upload a file in the main app to see real-time status updates</li>
          </ol>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-800">Implementation Details:</h3>
          <div className="space-y-2 text-blue-700 text-sm">
            <p><strong>SSE Endpoint:</strong> <code>/api/background-process?action=status&sse=true</code></p>
            <p><strong>Polling Endpoint:</strong> <code>/api/background-process?action=status</code></p>
            <p><strong>Fallback:</strong> Automatically falls back to polling if SSE fails</p>
            <p><strong>Real-time Updates:</strong> Job status changes are broadcast immediately via SSE</p>
          </div>
        </div>
      </div>

      {/* Show the JobStatus component if enabled */}
      {showJobStatus && filename && (
        <JobStatus
          filename={filename}
          method={method}
          checkStatusEndpoint="/api/background-process?action=status"
        />
      )}
    </>
  );
}
