"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
        setMessage(`File uploaded successfully: ${result.file.filename}`);
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setMessage("File upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) {
      setChatResponse("Please enter a question.");
      return;
    }

    setIsLoading(true);
    setChatResponse("Processing your question...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: chatInput }),
      });

      const result = await response.json();
      if (response.ok) {
        setChatResponse(result.answer);
      } else {
        setChatResponse(`Error: ${result.error}`);
      }
    } catch (error) {
      setChatResponse("Failed to fetch response.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Upload Bank Statement</h1>
        <input type="file" onChange={handleFileChange} className="mb-4 w-full" />
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? "Uploading..." : "Upload File"}
        </button>
        {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
      </div>

      <div className="w-full max-w-md mt-8">
        <h1 className="text-2xl font-bold mb-4">Chat Interface</h1>
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Example questions you can ask:</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• What's my total spending this month?</li>
            <li>• Show me all transactions above $100</li>
            <li>• What are my largest expenses?</li>
            <li>• How much did I spend on groceries?</li>
            <li>• What's my average transaction amount?</li>
          </ul>
        </div>
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          rows={4}
          placeholder="Ask a question about the uploaded data..."
        ></textarea>
        <button
          onClick={handleChatSubmit}
          disabled={isLoading}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Processing..." : "Submit Question"}
        </button>
        {chatResponse && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Answer:</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{chatResponse}</div>
          </div>
        )}
      </div>
    </div>
  );
}
