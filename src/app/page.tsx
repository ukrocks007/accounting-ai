"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: {
    transactions?: Record<string, unknown>[]; // More flexible to handle any transaction structure
    query?: string;
    summary?: Record<string, unknown>;
  };
}

interface StatementRow {
  id?: number;
  date?: string;
  description?: string;
  amount?: number;
  type?: "credit" | "debit";
  [key: string]: unknown; // Allow any additional properties
}

const TransactionTable = ({ transactions }: { transactions: Record<string, unknown>[] }) => {
  if (!transactions || transactions.length === 0) return null;

  // Dynamically determine columns from the first transaction
  const allColumns = Object.keys(transactions[0]);

  // Define preferred column order and hidden columns
  const columnPriority = ['id', 'date', 'created_at', 'description', 'amount', 'total', 'sum', 'type', 'source'];
  const hiddenColumns = ['created_at', 'updated_at']; // Hide these columns by default

  // Filter out hidden columns and sort by priority
  const visibleColumns = allColumns
    .filter(col => !hiddenColumns.includes(col))
    .sort((a, b) => {
      const aPriority = columnPriority.indexOf(a);
      const bPriority = columnPriority.indexOf(b);
      if (aPriority === -1 && bPriority === -1) return a.localeCompare(b);
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });

  // Helper function to format column names for display
  const formatColumnName = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to format cell values
  const formatCellValue = (key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>;
    }

    // Handle date formatting
    if (key.toLowerCase().includes('date') || key.toLowerCase().includes('created_at') || key.toLowerCase().includes('updated_at')) {
      try {
        return new Date(String(value)).toLocaleDateString();
      } catch {
        return String(value);
      }
    }

    // Handle amount formatting with color coding
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('sum')) {
      const numValue = parseFloat(String(value));
      if (!isNaN(numValue)) {
        // Try to determine if this is a credit or debit based on context
        const row = transactions.find(t => t[key] === value) as Record<string, unknown> | undefined;
        const rowType = row?.type as string | undefined;

        return (
          <span className={`font-mono ${key.toLowerCase().includes('amount') && rowType
              ? (rowType === 'credit' ? 'text-green-600' : 'text-red-600')
              : 'text-gray-800'
            }`}>
            {key.toLowerCase().includes('amount') && rowType
              ? `${rowType === 'credit' ? '+' : '-'}$${Math.abs(numValue).toFixed(2)}`
              : `$${Math.abs(numValue).toFixed(2)}`
            }
          </span>
        );
      }
    }

    // Handle type formatting with badges
    if (key.toLowerCase() === 'type' && (value === 'credit' || value === 'debit')) {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'credit'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
          }`}>
          {value === 'credit' ? 'Credit' : 'Debit'}
        </span>
      );
    }

    // Handle source with badges
    if (key.toLowerCase() === 'source') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {String(value)}
        </span>
      );
    }

    // Handle long descriptions with truncation
    if (key.toLowerCase().includes('description') && typeof value === 'string' && value.length > 50) {
      return (
        <span title={value} className="truncate block max-w-[200px]">
          {value.substring(0, 50)}...
        </span>
      );
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    // Handle numeric values (but not amounts)
    if (typeof value === 'number' && !key.toLowerCase().includes('amount')) {
      return <span className="font-mono">{value.toLocaleString()}</span>;
    }

    // Default formatting
    return String(value);
  };

  // Helper function to determine cell alignment
  const getCellAlignment = (key: string, value: unknown): string => {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('sum') || (typeof value === 'number' && !key.toLowerCase().includes('id'))) {
      return 'text-right';
    }
    if (key.toLowerCase() === 'type' || key.toLowerCase() === 'source' || typeof value === 'boolean') {
      return 'text-center';
    }
    return 'text-left';
  };

  // Helper function to get column header alignment
  const getHeaderAlignment = (key: string): string => {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('sum')) {
      return 'text-right';
    }
    if (key.toLowerCase() === 'type' || key.toLowerCase() === 'source') {
      return 'text-center';
    }
    return 'text-left';
  };

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300 rounded-lg text-xs">
        <thead className="bg-gray-50">
          <tr>
            {visibleColumns.map((column) => (
              <th key={column} className={`px-2 py-2 ${getHeaderAlignment(column)} text-gray-600 font-medium border-b`}>
                {formatColumnName(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={(transaction.id as string | number) || index} className="hover:bg-gray-50">
              {visibleColumns.map((column) => (
                <td key={column} className={`px-2 py-2 border-b text-gray-800 ${getCellAlignment(column, transaction[column])}`}>
                  {formatCellValue(column, transaction[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-between items-center text-xs text-gray-600">
        <div>
          Showing {transactions.length} result{transactions.length !== 1 ? 's' : ''}
        </div>
        {hiddenColumns.length > 0 && allColumns.some(col => hiddenColumns.includes(col)) && (
          <div className="text-gray-500">
            Hidden columns: {hiddenColumns.filter(col => allColumns.includes(col)).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<StatementRow[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [backgroundJob, setBackgroundJob] = useState<{ filename: string; checkStatusEndpoint: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const JobStatus = dynamic(() => import("./components/JobStatus"), { ssr: false });

  // Auto scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        let successMessage = `File processed successfully: ${result.file.filename}`;
        if (result.ragProcessed && result.backgroundProcessing?.enabled) {
          successMessage += `\n\n📋 Large document detected! Background processing has been enabled.`;
          setBackgroundJob({
            filename: result.file.filename,
            checkStatusEndpoint: result.backgroundProcessing.checkStatusEndpoint || "/api/background-process?action=status"
          });
          setShowReviewModal(false);
          setExtractedData([]);
        } else {
          // Sanitize the extracted data to ensure all rows have valid type field
          const sanitizedData = (result.extractedData || []).map((row: Record<string, unknown>) => ({
            ...row,
            type: row.type || 'debit' // Default to 'debit' if type is missing
          }));
          setExtractedData(sanitizedData);
          setShowReviewModal(true);
          setBackgroundJob(null);
        }
        setMessage(successMessage);
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch {
      setMessage("File upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmData = async () => {
    setIsConfirming(true);
    try {
      const response = await fetch("/api/confirm-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: extractedData }),
      });

      const result = await response.json();
      if (response.ok) {
        setMessage(`Data saved successfully! ${result.count} transactions processed.`);
        setShowReviewModal(false);
        setExtractedData([]);
        setFile(null);
      } else {
        setMessage(`Error saving data: ${result.error}`);
      }
    } catch {
      setMessage("Failed to save data.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleEditRow = (index: number, field: keyof StatementRow, value: string | number) => {
    const updatedData = [...extractedData];
    if (field === 'amount') {
      updatedData[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else if (field === 'type') {
      updatedData[index][field] = (value as "credit" | "debit") || "debit";
    } else if (field === 'id') {
      updatedData[index][field] = typeof value === 'string' ? parseInt(value) || undefined : value as number;
    } else {
      updatedData[index][field] = value as string;
    }
    setExtractedData(updatedData);
  };

  const handleDeleteRow = (index: number) => {
    const updatedData = extractedData.filter((_, i) => i !== index);
    setExtractedData(updatedData);
  };

  const handleAddRow = () => {
    const newRow: StatementRow = {
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: 0,
      type: "debit"
    };
    setExtractedData([...extractedData, newRow]);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatHistory(prev => [...prev, userMessage]);
    setChatInput("");
    setIsLoading(true);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, loadingMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userMessage.content }),
      });

      const result = await response.json();

      // Replace loading message with actual response
      setChatHistory(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
              ...msg,
              content: response.ok ? result.answer : `Error: ${result.error}`,
              data: response.ok ? result.data : undefined,
              timestamp: new Date(),
            }
            : msg
        )
      );
    } catch {
      // Replace loading message with error
      setChatHistory(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
              ...msg,
              content: "Failed to fetch response. Please try again.",
              timestamp: new Date(),
            }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-300">
        <div className="max-w-6xl mx-auto px-2 py-2">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Accounting AI Assistant</h1>
              <p className="text-gray-600 text-sm">Upload your financial documents (PDF, Excel, CSV) and ask questions</p>
            </div>
            <nav className="flex gap-4 items-center">
              {backgroundJob && (
                <div className="mr-4">
                  <JobStatus checkStatusEndpoint={backgroundJob.checkStatusEndpoint} filename={backgroundJob.filename} />
                </div>
              )}
              <Link
                href="/statements"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Manage Statements
              </Link>
              <Link
                href="/admin/background-processing"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Admin Panel
              </Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-2">
        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Financial Statement
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="file"
              onChange={handleFileChange}
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              accept=".csv,.xlsx,.xls,.pdf"
            />
            <button
              onClick={handleUpload}
              disabled={isUploading || !file}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
          {message && (
            <div className={`mt-3 p-3 rounded-lg ${message.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-lg shadow-sm h-[680px] flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-300 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat with your data
            </h2>
            {chatHistory.length > 0 && (
              <button
                onClick={clearChat}
                className="text-sm text-gray-700 hover:text-gray-700 px-3 py-1 rounded-md hover:bg-gray-100"
              >
                Clear chat
              </button>
            )}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-700 py-8">
                <div className="mb-4">
                  <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-lg mb-2">Start a conversation</p>
                <p className="text-sm mb-4">Upload a file and ask questions about your financial data</p>
                <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                  <h3 className="font-semibold text-sm mb-2 text-blue-800">Example questions:</h3>
                  <ul className="text-xs text-blue-600 space-y-1 text-left">
                    <li>• What&apos;s my total spending this month?</li>
                    <li>• Show me all income statements</li>
                    <li>• List all transactions above $100</li>
                    <li>• What are my largest expenses?</li>
                    <li>• Show me all credit transactions</li>
                    <li>• How much did I spend on groceries?</li>
                    <li>• What&apos;s my average transaction amount?</li>
                  </ul>
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${msg.type === 'user' ? 'max-w-xs lg:max-w-md' : 'max-w-full lg:max-w-4xl'} px-4 py-2 rounded-lg ${msg.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                    }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.type === 'assistant' && msg.data?.transactions && (
                      <TransactionTable transactions={msg.data.transactions} />
                    )}
                    <p className={`text-xs mt-1 ${msg.type === 'user' ? 'text-blue-100' : 'text-gray-700'
                      }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-300">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your financial data..."
                className="text-gray-600 flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={handleChatSubmit}
                disabled={isLoading || !chatInput.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && !backgroundJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-300">
              <h2 className="text-xl font-bold text-gray-800">Review Extracted Data</h2>
              <p className="text-gray-600 mt-1">Please review and edit the extracted transactions before saving to database</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {extractedData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-700">No data extracted from the file.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Amount</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {editingRow === index ? (
                              <input
                                type="date"
                                value={row.date}
                                onChange={(e) => handleEditRow(index, 'date', e.target.value)}
                                className="w-full p-1 border rounded"
                              />
                            ) : (
                              <span onClick={() => setEditingRow(index)} className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                                {row.date}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {editingRow === index ? (
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => handleEditRow(index, 'description', e.target.value)}
                                className="w-full p-1 border rounded"
                              />
                            ) : (
                              <span onClick={() => setEditingRow(index)} className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                                {row.description}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {editingRow === index ? (
                              <input
                                type="number"
                                step="0.01"
                                value={row.amount || 0}
                                onChange={(e) => handleEditRow(index, 'amount', e.target.value)}
                                className="w-full p-1 border rounded"
                              />
                            ) : (
                              <span onClick={() => setEditingRow(index)} className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                                ${(row.amount || 0).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {editingRow === index ? (
                              <select
                                value={row.type || "debit"}
                                onChange={(e) => handleEditRow(index, 'type', e.target.value)}
                                className="w-full p-1 border rounded"
                              >
                                <option value="credit">Credit</option>
                                <option value="debit">Debit</option>
                              </select>
                            ) : (
                              <span onClick={() => setEditingRow(index)} className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded capitalize ${(row.type || 'debit') === 'credit' ? 'text-green-600' : 'text-red-600'}`}>{row.type || 'debit'}</span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <div className="flex gap-2">
                              {editingRow === index ? (
                                <button
                                  onClick={() => setEditingRow(null)}
                                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                  Save
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEditingRow(index)}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRow(index)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4">
                <button
                  onClick={handleAddRow}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Add Row
                </button>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setExtractedData([]);
                  setEditingRow(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                disabled={isConfirming}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmData}
                disabled={isConfirming || extractedData.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? "Saving..." : `Save ${extractedData.length} Transactions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
