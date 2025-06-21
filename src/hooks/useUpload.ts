import { useState } from 'react';

interface TransactionData {
  [key: string]: string | number | Date;
}

interface UploadState {
  file: File | null;
  message: string;
  isUploading: boolean;
  extractedData: TransactionData[];
  showReviewModal: boolean;
  isConfirming: boolean;
  editingRow: number | null;
  backgroundJob: { filename: string; checkStatusEndpoint: string } | null;
}

interface UseUploadReturn extends UploadState {
  setFile: (file: File | null) => void;
  setMessage: (message: string) => void;
  setIsUploading: (isUploading: boolean) => void;
  setExtractedData: (data: TransactionData[]) => void;
  setShowReviewModal: (show: boolean) => void;
  setIsConfirming: (confirming: boolean) => void;
  setEditingRow: (row: number | null) => void;
  setBackgroundJob: (job: { filename: string; checkStatusEndpoint: string } | null) => void;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleDeleteRow: (index: number) => void;
  handleEditRow: (index: number, field: string, value: string) => void;
  handleConfirmData: () => Promise<void>;
}

export function useUpload(): UseUploadReturn {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<TransactionData[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [backgroundJob, setBackgroundJob] = useState<{ filename: string; checkStatusEndpoint: string } | null>(null);

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
        if (result.needsBackgroundProcessing) {
          setMessage(`File upload successful! Large file detected - processing in background.`);
          setBackgroundJob({
            filename: file.name,
            checkStatusEndpoint: result.checkStatusEndpoint,
          });
        } else {
          setMessage("File uploaded and processed successfully!");
          if (result.extractedData && result.extractedData.length > 0) {
            setExtractedData(result.extractedData);
            setShowReviewModal(true);
          }
        }
      } else {
        setMessage(`Upload failed: ${result.error}`);
      }
    } catch {
      setMessage("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteRow = (index: number) => {
    setExtractedData(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditRow = (index: number, field: string, value: string) => {
    setExtractedData(prev => prev.map((row, i) => 
      i === index ? { ...row, [field]: value } : row
    ));
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
        setMessage("Data confirmed and saved successfully!");
        setShowReviewModal(false);
        setExtractedData([]);
      } else {
        setMessage(`Failed to save data: ${result.error}`);
      }
    } catch {
      setMessage("Failed to save data. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  return {
    file,
    message,
    isUploading,
    extractedData,
    showReviewModal,
    isConfirming,
    editingRow,
    backgroundJob,
    setFile,
    setMessage,
    setIsUploading,
    setExtractedData,
    setShowReviewModal,
    setIsConfirming,
    setEditingRow,
    setBackgroundJob,
    handleFileChange,
    handleUpload,
    handleDeleteRow,
    handleEditRow,
    handleConfirmData,
  };
}
