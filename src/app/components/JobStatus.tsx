import { useEffect, useState } from "react";

interface JobStatusProps {
  checkStatusEndpoint: string;
  filename: string;
}

interface Job {
  status?: string;
  status_description?: string;
  error_message?: string;
  total_chunks?: number;
  processed_at?: string;
  created_at?: string;
}

export default function JobStatus({ checkStatusEndpoint, filename }: JobStatusProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${checkStatusEndpoint}&filename=${encodeURIComponent(filename)}`);
        const data = await res.json();
        if (data.job) {
          setJob(data.job);
          setError("");
        } else {
          setJob(null);
          setError("No job found");
        }
      } catch (e) {
        setError("Failed to fetch job status");
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatusEndpoint, filename]);

  let statusColor = "text-blue-600";
  let statusBar = "bg-blue-400";
  if (job?.status === "completed") {
    statusColor = "text-green-600";
    statusBar = "bg-green-400";
  } else if (job?.status === "failed") {
    statusColor = "text-red-600";
    statusBar = "bg-red-400";
  } else if (job?.status === "processing") {
    statusColor = "text-yellow-600";
    statusBar = "bg-yellow-400";
  }

  return (
    <div className="rounded-lg shadow-md px-4 py-3 bg-white border border-gray-200 min-w-[260px] max-w-xs flex flex-col items-start">
      <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        Background Job Status
      </div>
      {loading ? (
        <div className="text-gray-500 animate-pulse">Checking status...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : job ? (
        <>
          <div className={`font-bold ${statusColor} text-sm mb-1`}>{job.status_description || job.status}</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className={`${statusBar} h-2 rounded-full transition-all duration-500`}
              style={{ width: job.status === "completed" ? "100%" : job.status === "failed" ? "100%" : job.status === "processing" ? "60%" : "30%" }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mb-1">
            <span className="font-medium">File:</span> {filename}
          </div>
          <div className="text-xs text-gray-500 mb-1">
            <span className="font-medium">Status:</span> {job.status}
          </div>
          {job.error_message && (
            <div className="text-xs text-red-500 mb-1">Error: {job.error_message}</div>
          )}
          {job.processed_at && (
            <div className="text-xs text-green-600 mb-1">Processed at: {new Date(job.processed_at).toISOString().replace('T', ' ').replace(/\..+/, '')}</div>
          )}
        </>
      ) : null}
    </div>
  );
}
