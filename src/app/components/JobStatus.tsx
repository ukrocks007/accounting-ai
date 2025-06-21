import { useState, useMemo, memo } from "react";
import { Info, X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useJobPolling } from "../hooks/useJobPolling";

// Helper function to capitalize first letter of a string
const capitalize = (str: string = "") => {
    if (!str) return str;
    if (typeof str !== "string") return str;
    str = str.trim();
    if (str.length === 0) return str;
    if (str.length === 1) return str.toUpperCase();
    return str.charAt(0).toUpperCase() + str.slice(1);
};

interface JobStatusProps {
    checkStatusEndpoint: string;
    filename: string;
}

function JobStatus({ checkStatusEndpoint, filename }: JobStatusProps) {
    const [visible, setVisible] = useState(true);
    const { job, error, loading } = useJobPolling({
        checkStatusEndpoint,
        filename,
        enablePolling: visible // Stop polling when component is hidden
    });

    // Memoize status styling to prevent recalculation on every render
    const statusConfig = useMemo(() => {
        const config = {
            color: "text-blue-600",
            bar: "bg-blue-400",
            progress: "30%",
            icon: <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        };

        if (job?.status === "completed") {
            config.color = "text-green-600";
            config.bar = "bg-green-400";
            config.progress = "100%";
            config.icon = <CheckCircle className="w-4 h-4 text-green-600" />;
        } else if (job?.status === "failed") {
            config.color = "text-red-600";
            config.bar = "bg-red-400";
            config.progress = "100%";
            config.icon = <AlertTriangle className="w-4 h-4 text-red-600" />;
        } else if (job?.status === "processing") {
            config.color = "text-yellow-600";
            config.bar = "bg-yellow-400";
            config.progress = "60%";
            config.icon = <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />;
        }

        return config;
    }, [job?.status]);

    // Memoize formatted processed date to prevent recalculation
    const formattedProcessedAt = useMemo(() => {
        if (!job?.processed_at) return null;
        return new Date(job.processed_at).toISOString().replace('T', ' ').replace(/\..+/, '');
    }, [job?.processed_at]);

    if (!visible) return null;

    return (
        <div className="fixed top-6 right-6 z-50 rounded-lg shadow-2xl px-4 py-3 bg-white border border-gray-200 min-w-[260px] max-w-xs flex flex-col items-start animate-fade-in">
            <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 focus:outline-none"
                aria-label="Close"
                onClick={() => setVisible(false)}
                style={{ background: "none", border: "none", padding: 0, margin: 0 }}
            >
                <X className="w-5 h-5" />
            </button>

            <div className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Background Job Status
            </div>
            <div className="px-1 py-1">
                {loading ? (
                    <div className="text-gray-500 animate-pulse flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking status...
                    </div>
                ) : error ? (
                    <div className="text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                ) : job ? (
                    <>
                        <div className={`font-bold ${statusConfig.color} text-sm mb-1 flex items-center gap-2`}>
                            {statusConfig.icon}
                            {job.status_description || job.status}
                        </div>

                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                            <div
                                className={`${statusConfig.bar} h-2 rounded-full transition-all duration-500`}
                                style={{ width: statusConfig.progress }}
                            />
                        </div>

                        <div className="text-xs text-gray-500 mb-2">
                            <span className="font-medium">File:</span> <span className="break-all">{filename}</span>
                        </div>

                        <div className="text-xs text-gray-500 mb-1">
                            <span className="font-medium">Status:</span> {capitalize(job.status)}
                        </div>

                        {job.error_message && (
                            <div className="text-xs text-red-500 mb-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Error: {job.error_message}
                            </div>
                        )}

                        {formattedProcessedAt && (
                            <div className="text-xs text-green-600 mb-1 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Processed at: {formattedProcessedAt}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}

// Memoize the component to prevent unnecessary re-renders when parent re-renders
export default memo(JobStatus);
