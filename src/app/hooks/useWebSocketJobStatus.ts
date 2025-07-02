import { useEffect, useRef, useState, useCallback } from 'react';

interface Job {
  status?: string;
  status_description?: string;
  error_message?: string;
  total_chunks?: number;
  processed_at?: string;
  created_at?: string;
}

interface UseWebSocketJobStatusOptions {
  url: string;
  enabled?: boolean;
}

interface UseWebSocketJobStatusReturn {
  job: Job | null;
  error: string;
  loading: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (msg: any) => void;
  refetch: () => void;
}

export function useWebSocketJobStatus({ url, enabled = true }: UseWebSocketJobStatusOptions): UseWebSocketJobStatusReturn {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    setConnectionStatus('connecting');
    setError('');
    setLoading(true);
    const ws = new window.WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      setError('');
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'job_status' && data.job) {
          setJob(data.job);
          setLoading(false);
        }
        // handle other message types as needed
      } catch (e) {
        setError('Failed to parse message');
      }
    };
    ws.onerror = (event) => {
      setConnectionStatus('error');
      setError('WebSocket error');
      setLoading(false);
    };
    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };
  }, [url, enabled]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const refetch = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (enabled) connect();
    return () => disconnect();
  }, [connect, disconnect, enabled]);

  return { job, error, loading, connectionStatus, sendMessage, refetch };
}
