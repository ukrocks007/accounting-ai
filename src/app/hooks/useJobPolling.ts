import { useCallback, useEffect, useRef, useState } from "react";

interface Job {
    status?: string;
    status_description?: string;
    error_message?: string;
    total_chunks?: number;
    processed_at?: string;
    created_at?: string;
}

interface UseJobPollingOptions {
    checkStatusEndpoint: string;
    filename: string;
    pollingInterval?: number;
    enablePolling?: boolean;
}

interface UseJobPollingReturn {
    job: Job | null;
    error: string;
    loading: boolean;
    refetch: () => void;
}

export function useJobPolling({
    checkStatusEndpoint,
    filename,
    pollingInterval = 3000,
    enablePolling = true
}: UseJobPollingOptions): UseJobPollingReturn {
    const [job, setJob] = useState<Job | null>(null);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(true);
    
    // Refs to track request state and prevent multiple concurrent requests
    const isRequestInProgress = useRef(false);
    const shouldContinuePolling = useRef(true);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchStatus = useCallback(async () => {
        // Prevent multiple concurrent requests
        if (isRequestInProgress.current) {
            return;
        }

        isRequestInProgress.current = true;
        
        try {
            const res = await fetch(`${checkStatusEndpoint}&filename=${encodeURIComponent(filename)}`);
            const data = await res.json();
            
            if (data.job) {
                setJob(prevJob => {
                    // Only update if data actually changed to prevent unnecessary re-renders
                    if (JSON.stringify(prevJob) !== JSON.stringify(data.job)) {
                        return data.job;
                    }
                    return prevJob;
                });
                setError("");
                
                // Stop polling if job is completed or failed
                if (data.job.status === "completed" || data.job.status === "failed") {
                    shouldContinuePolling.current = false;
                }
            } else {
                setJob(null);
                setError("No job found");
                shouldContinuePolling.current = false;
            }
        } catch {
            setError("Failed to fetch job status");
            // Continue polling on network errors in case it's temporary
        } finally {
            setLoading(false);
            isRequestInProgress.current = false;
        }
    }, [checkStatusEndpoint, filename]);

    const scheduleNextFetch = useCallback(() => {
        if (shouldContinuePolling.current && enablePolling) {
            timeoutRef.current = setTimeout(() => {
                fetchStatus().then(() => {
                    // Schedule next fetch only after current one completes
                    scheduleNextFetch();
                });
            }, pollingInterval);
        }
    }, [fetchStatus, pollingInterval, enablePolling]);

    const refetch = useCallback(() => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        // Reset polling state
        shouldContinuePolling.current = true;
        setLoading(true);
        
        // Fetch immediately and then schedule next fetch
        fetchStatus().then(() => {
            scheduleNextFetch();
        });
    }, [fetchStatus, scheduleNextFetch]);

    useEffect(() => {
        // Start initial fetch and polling
        refetch();

        // Cleanup function
        return () => {
            shouldContinuePolling.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [checkStatusEndpoint, filename, refetch]); // Only re-run if endpoint or filename changes

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            shouldContinuePolling.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        job,
        error,
        loading,
        refetch
    };
}
