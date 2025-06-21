import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: {
    transactions?: Record<string, unknown>[];
    query?: string;
    summary?: Record<string, unknown>;
  };
}

interface UseChatReturn {
  chatInput: string;
  setChatInput: (input: string) => void;
  chatHistory: ChatMessage[];
  isLoading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleChat: () => Promise<void>;
  clearHistory: () => void;
}

export function useChat(): UseChatReturn {
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    setChatInput("");

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: chatInput }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer || 'Sorry, I could not process your request.',
        timestamp: new Date(),
        data: data.data,
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setChatHistory([]);
  };

  return {
    chatInput,
    setChatInput,
    chatHistory,
    isLoading,
    chatEndRef,
    inputRef,
    handleChat,
    clearHistory,
  };
}
