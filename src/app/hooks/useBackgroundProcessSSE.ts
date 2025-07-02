import { useCallback, useEffect, useRef, useState } from "react";

interface Job {
    status?: string;
    status_description?: string;
    error_message?: string;
    total_chunks?: number;
    processed_at?: string;
    created_at?: string;
}

interface Summary {
    total_jobs: number;
    pending_jobs: number;
    processing_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
}

interface UseBackgroundProcessSSEOptions {
    filename?: string;
    enabled?: boolean;
    pollingFallback?: boolean; // Whether to fall back to polling if SSE fails
}

interface UseBackgroundProcessSSEReturn {
    job: Job | null;
    jobs: Job[];
    summary: Summary | null;
    error: string;
    loading: boolean;
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
    refetch: () => void;
}

export function useBackgroundProcessSSE({
    filename,
    enabled = true,
    pollingFallback = true
}: UseBackgroundProcessSSEOptions): UseBackgroundProcessSSEReturn {
    const [job, setJob] = useState<Job | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    
    const eventSourceRef = useRef<EventSource | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const clientIdRef = useRef<string>(Math.random().toString(36).substring(7));

    // Polling fallback function
    const fetchStatusPolling = useCallback(async () => {
        try {
            const url = `/api/background-process?action=status${filename ? `&filename=${encodeURIComponent(filename)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (response.ok) {
                if (filename && data.job) {
                    setJob(data.job);
                    setError("");
                } else if (!filename && data.summary && data.jobs) {
                    setSummary(data.summary);
                    setJobs(data.jobs);
                    setError("");
                }
                setLoading(false);
            } else {
                setError(data.error || "Failed to fetch status");
                setLoading(false);
            }
        } catch (err) {
            setError("Network error occurred");
            setLoading(false);
        }
    }, [filename]);

    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
        
        fetchStatusPolling(); // Initial fetch
        pollingIntervalRef.current = setInterval(fetchStatusPolling, 5000); // Poll every 5 seconds
    }, [fetchStatusPolling]);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        stopPolling();
        setConnectionStatus('disconnected');
    }, [stopPolling]);

    const connect = useCallback(() => {
        if (!enabled) return;
        
        // Disconnect existing connection
        disconnect();
        
        setConnectionStatus('connecting');
        setError("");
        
        // Create SSE connection with proper URL
        const url = `/api/background-process?action=status&sse=true${filename ? `&filename=${encodeURIComponent(filename)}` : ''}`;
        
        try {
            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;
            setupSSEHandlers(eventSource);
        } catch (error) {
            console.error('Failed to create EventSource:', error);
            if (pollingFallback) {
                console.log('EventSource creation failed, falling back to polling');
                setConnectionStatus('error');
                startPolling();
            } else {
                setConnectionStatus('error');
                setError('Real-time updates not available');
            }
        }

    }, [filename, enabled, disconnect, pollingFallback, startPolling]);

    const setupSSEHandlers = (eventSource: EventSource) => {
        eventSource.onopen = () => {
            setConnectionStatus('connected');
            setError("");
        };

        // Handle connection confirmation
        eventSource.addEventListener('connection', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Background Process SSE Connected:', data);
                setConnectionStatus('connected');
            } catch (e) {
                console.error('Error parsing connection data:', e);
            }
        });

        // Handle status updates
        eventSource.addEventListener('status', (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'job_status' && data.job) {
                    setJob(prevJob => {
                        if (JSON.stringify(prevJob) !== JSON.stringify(data.job)) {
                            return data.job;
                        }
                        return prevJob;
                    });
                    setError("");
                    setLoading(false);
                } else if (data.type === 'status_summary' && data.summary && data.jobs) {
                    setSummary(data.summary);
                    setJobs(data.jobs);
                    setError("");
                    setLoading(false);
                }
            } catch (e) {
                console.error('Error parsing status data:', e);
                setError("Failed to parse status update");
            }
        });

        // Handle job completion
        eventSource.addEventListener('finished', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'job_finished' && data.job) {
                    setJob(data.job);
                    setLoading(false);
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
                setError("Connection error occurred");
            }
            setLoading(false);
        });

        eventSource.onerror = (event) => {
            console.error('Background Process SSE Error:', event);
            setConnectionStatus('error');
            setError("Connection to server lost");
            setLoading(false);
            
            // Attempt to reconnect after a delay if still enabled
            if (enabled) {
                setTimeout(() => {
                    if (enabled && eventSourceRef.current === eventSource) {
                        if (pollingFallback) {
                            console.log('SSE failed, switching to polling');
                            startPolling();
                        } else {
                            connect();
                        }
                    }
                }, 5000);
            }
        };
    };

    const refetch = useCallback(() => {
        setLoading(true);
        setJob(null);
        setJobs([]);
        setSummary(null);
        setError("");
        connect();
    }, [connect]);

    useEffect(() => {
        if (enabled) {
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
        jobs,
        summary,
        error,
        loading,
        connectionStatus,
        refetch
    };
}
