'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { CheckCircle, AlertTriangle, Loader2, Server, Cpu, HardDrive } from 'lucide-react';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface OllamaStatus {
  models: OllamaModel[];
  version?: string;
}

export default function OllamaAdmin() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const checkOllamaStatus = async () => {
    setStatus('checking');
    setError('');
    
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: OllamaStatus = await response.json();
      setModels(data.models || []);
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const testModel = async () => {
    setTesting(true);
    setTestResult('');
    
    try {
      const response = await fetch('/api/test-ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'Extract data from: "2024-01-15 Coffee Shop -$4.50". Return JSON with date, description, amount, type.' 
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setTestResult(`✅ Success: ${result.response || result.message}`);
      } else {
        setTestResult(`❌ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setTestResult(`❌ Network Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const StatusIndicator = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking connection...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Connected to Ollama</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span>Connection failed</span>
          </div>
        );
    }
  };

  return (
    <>
      <Header title="Ollama Administration" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Ollama Configuration</h1>
          <button
            onClick={checkOllamaStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Status
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Server className="w-6 h-6" />
              Ollama Server Status
            </h2>
            <StatusIndicator />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
              <div className="mt-2 text-sm text-red-600">
                <p>Troubleshooting steps:</p>
                <ul className="list-disc list-inside ml-4">
                  <li>Make sure Ollama is running: <code className="bg-red-100 px-1 rounded">ollama serve</code></li>
                  <li>Check if port 11434 is accessible</li>
                  <li>Verify CORS settings if running in production</li>
                </ul>
              </div>
            </div>
          )}

          {status === 'connected' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Total Models</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{models.length}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Endpoint</span>
                </div>
                <p className="text-sm text-gray-600">localhost:11434</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Llama3:8b</span>
                </div>
                <p className={`text-sm font-medium ${
                  models.some(m => m.name.includes('llama3:8b')) 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {models.some(m => m.name.includes('llama3:8b')) ? 'Available' : 'Not Found'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Models List */}
        {status === 'connected' && (
          <div className="bg-white rounded-lg shadow-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Installed Models</h2>
            </div>
            
            {models.length === 0 ? (
              <div className="p-8 text-center text-gray-600">
                <p>No models found. Install Llama3:8b:</p>
                <code className="bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                  ollama pull llama3:8b
                </code>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Model Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Modified
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {models.map((model, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {model.name}
                          {model.name.includes('llama3:8b') && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active for Upload
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatSize(model.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(model.modified_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ready
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Test Section */}
        {status === 'connected' && models.some(m => m.name.includes('llama3:8b')) && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Test Model</h2>
            <p className="text-gray-600 mb-4">
              Test the Llama3:8b model with a sample financial document processing task.
            </p>
            
            <button
              onClick={testModel}
              disabled={testing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors mb-4"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Testing...
                </>
              ) : (
                'Test Financial Processing'
              )}
            </button>

            {testResult && (
              <div className={`p-4 rounded-lg ${
                testResult.startsWith('✅') 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
              </div>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        {status === 'error' && (
          <div className="bg-blue-50 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">Setup Instructions</h2>
            <div className="space-y-4 text-blue-700">
              <div>
                <h3 className="font-medium">1. Install Ollama</h3>
                <code className="bg-blue-100 px-2 py-1 rounded text-sm">
                  curl -fsSL https://ollama.ai/install.sh | sh
                </code>
              </div>
              
              <div>
                <h3 className="font-medium">2. Start Ollama</h3>
                <code className="bg-blue-100 px-2 py-1 rounded text-sm">
                  ollama serve
                </code>
              </div>
              
              <div>
                <h3 className="font-medium">3. Install Llama3:8b</h3>
                <code className="bg-blue-100 px-2 py-1 rounded text-sm">
                  ollama pull llama3:8b
                </code>
              </div>
              
              <div>
                <h3 className="font-medium">4. Test Installation</h3>
                <code className="bg-blue-100 px-2 py-1 rounded text-sm">
                  ollama run llama3:8b "Hello"
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
