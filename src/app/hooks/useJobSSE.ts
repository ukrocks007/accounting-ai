import { useCallback, useEffect, useRef, useState } from "react";

interface Job {
    status?: string;
    status_description?: string;
    error_message?: string;
    total_chunks?: number;
    processed_at?: string;
    created_at?: string;
}

interface UseJobSSEOptions {
    filename: string;
    enabled?: boolean;
}

interface UseJobSSEReturn {
    job: Job | null;
    error: string;
    loading: boolean;
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
    refetch: () => void;
}

export function useJobSSE({
    filename,
    enabled = true
}: UseJobSSEOptions): UseJobSSEReturn {
    const [job, setJob] = useState<Job | null>(null);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    
    const eventSourceRef = useRef<EventSource | null>(null);
    const clientIdRef = useRef<string>(Math.random().toString(36).substring(7));

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setConnectionStatus('disconnected');
    }, []);

    const connect = useCallback(() => {
        if (!enabled || !filename) return;
        
        // Disconnect existing connection
        disconnect();
        
        setConnectionStatus('connecting');
        setError("");
        
        const url = `/api/sse?filename=${encodeURIComponent(filename)}&clientId=${clientIdRef.current}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setConnectionStatus('connected');
            setError("");
        };

        // Handle connection confirmation
        eventSource.addEventListener('connection', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('SSE Connected:', data);
                setConnectionStatus('connected');
            } catch (e) {
                console.error('Error parsing connection data:', e);
            }
        });

        // Handle job status updates
        eventSource.addEventListener('status', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'job_status' && data.job) {
                    setJob(prevJob => {
                        // Only update if data actually changed
                        if (JSON.stringify(prevJob) !== JSON.stringify(data.job)) {
                            return data.job;
                        }
                        return prevJob;
                    });
                    setError("");
                    setLoading(false);
                }
            } catch (e) {
                console.error('Error parsing status data:', e);
                setError("Failed to parse job status");
            }
        });

        // Handle job completion
        eventSource.addEventListener('finished', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'job_finished' && data.job) {
                    setJob(data.job);
                    setLoading(false);
                    // Connection will be closed by server
                }
            } catch (e) {
                console.error('Error parsing finished data:', e);
            }
        });

        // Handle errors
        eventSource.addEventListener('error', (event) => {
            try {
                const messageEvent = event as MessageEvent;
                const data = JSON.parse(messageEvent.data);
                setError(data.error || "Unknown error occurred");
            } catch (e) {
                // If we can't parse the error, use a generic message
                setError("Connection error occurred");
            }
            setLoading(false);
        });

        eventSource.onerror = (event) => {
            console.error('SSE Error:', event);
            setConnectionStatus('error');
            setError("Connection to server lost");
            setLoading(false);
            
            // Attempt to reconnect after a delay if still enabled
            if (enabled) {
                setTimeout(() => {
                    if (enabled && eventSourceRef.current === eventSource) {
                        connect();
                    }
                }, 5000);
            }
        };

    }, [filename, enabled, disconnect]);

    const refetch = useCallback(() => {
        setLoading(true);
        setJob(null);
        setError("");
        connect();
    }, [connect]);

    useEffect(() => {
        if (enabled && filename) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [filename, enabled, connect, disconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        job,
        error,
        loading,
        connectionStatus,
        refetch
    };
}
