"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file to upload.");
      return;
    }

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
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) {
      setChatResponse("Please enter a question.");
      return;
    }

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
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Upload Bank Statement</h1>
        <input type="file" onChange={handleFileChange} className="mb-4 w-full" />
        <button
          onClick={handleUpload}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Upload File
        </button>
        {message && <p className="mt-4 text-sm text-red-500">{message}</p>}
      </div>

      <div className="w-full max-w-md mt-8">
        <h1 className="text-2xl font-bold mb-4">Chat Interface</h1>
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          rows={4}
          placeholder="Ask a question about the uploaded data..."
        ></textarea>
        <button
          onClick={handleChatSubmit}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          Submit Question
        </button>
        {chatResponse && <p className="mt-4 text-sm text-gray-700">{chatResponse}</p>}
      </div>
    </div>
  );
}
