import { useState, useEffect, useCallback } from 'react';
import { StatementRow } from '@/lib/dbManager';

interface PaginationInfo {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

interface StatementsResponse {
    success: boolean;
    data: StatementRow[];
    pagination: PaginationInfo;
    error?: string;
}

interface Filters {
    startDate: string;
    endDate: string;
    type: string;
    minAmount: string;
    maxAmount: string;
}

interface FormData {
    date: string;
    description: string;
    amount: string;
    type: 'credit' | 'debit';
    source: string;
}

export function useStatements() {
    const [statements, setStatements] = useState<StatementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
    });

    const [filters, setFilters] = useState<Filters>({
        startDate: '',
        endDate: '',
        type: '',
        minAmount: '',
        maxAmount: '',
    });

    const [selectedStatements, setSelectedStatements] = useState<Set<number>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    
    const [formData, setFormData] = useState<FormData>({
        date: '',
        description: '',
        amount: '',
        type: 'debit',
        source: 'manual',
    });

    // Fetch statements
    const fetchStatements = useCallback(async (page = 1, resetFilters = false) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
            });
            
            const currentFilters = resetFilters ? { startDate: '', endDate: '', type: '', minAmount: '', maxAmount: '' } : filters;
            
            if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
            if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
            if (currentFilters.type) params.append('type', currentFilters.type);
            if (currentFilters.minAmount) params.append('minAmount', currentFilters.minAmount);
            if (currentFilters.maxAmount) params.append('maxAmount', currentFilters.maxAmount);

            const response = await fetch(`/api/statements?${params}`);
            const data: StatementsResponse = await response.json();

            if (data.success) {
                setStatements(data.data);
                setPagination(data.pagination);
            } else {
                setError(data.error || 'Failed to fetch statements');
            }
        } catch {
            setError('Network error occurred');
        } finally {
            setLoading(false);
        }
    }, [pagination.limit, filters]);

    // Create statement
    const createStatement = async () => {
        try {
            const response = await fetch('/api/statements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                resetForm();
                fetchStatements(pagination.page);
                return { success: true };
            } else {
                setError(data.error || 'Failed to create statement');
                return { success: false, error: data.error };
            }
        } catch {
            setError('Network error occurred');
            return { success: false, error: 'Network error occurred' };
        }
    };

    // Update statement
    const updateStatement = async (id: number) => {
        try {
            const response = await fetch(`/api/statements/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                resetForm();
                fetchStatements(pagination.page);
                return { success: true };
            } else {
                setError(data.error || 'Failed to update statement');
                return { success: false, error: data.error };
            }
        } catch {
            setError('Network error occurred');
            return { success: false, error: 'Network error occurred' };
        }
    };

    // Delete statement
    const deleteStatement = async (id: number) => {
        if (!confirm('Are you sure you want to delete this statement?')) return { success: false };

        try {
            const response = await fetch(`/api/statements/${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                fetchStatements(pagination.page);
                return { success: true };
            } else {
                setError(data.error || 'Failed to delete statement');
                return { success: false, error: data.error };
            }
        } catch {
            setError('Network error occurred');
            return { success: false, error: 'Network error occurred' };
        }
    };

    // Delete selected statements
    const deleteSelectedStatements = async () => {
        if (selectedStatements.size === 0) {
            setError('No statements selected');
            return { success: false };
        }

        if (!confirm(`Are you sure you want to delete ${selectedStatements.size} selected statements?`)) return { success: false };

        try {
            const response = await fetch('/api/statements', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedStatements) }),
            });

            const data = await response.json();

            if (data.success) {
                setSelectedStatements(new Set());
                setSelectAll(false);
                fetchStatements(pagination.page);
                return { success: true };
            } else {
                setError(data.error || 'Failed to delete selected statements');
                return { success: false, error: data.error };
            }
        } catch {
            setError('Network error occurred');
            return { success: false, error: 'Network error occurred' };
        }
    };

    // Delete all statements
    const deleteAllStatements = async () => {
        if (!confirm('Are you sure you want to delete ALL statements? This action cannot be undone.')) return { success: false };

        try {
            const response = await fetch('/api/statements?deleteAll=true', {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                setSelectedStatements(new Set());
                setSelectAll(false);
                fetchStatements(1);
                return { success: true };
            } else {
                setError(data.error || 'Failed to delete all statements');
                return { success: false, error: data.error };
            }
        } catch {
            setError('Network error occurred');
            return { success: false, error: 'Network error occurred' };
        }
    };

    const resetForm = () => {
        setFormData({
            date: '',
            description: '',
            amount: '',
            type: 'debit',
            source: 'manual',
        });
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedStatements(new Set());
        } else {
            setSelectedStatements(new Set(statements.map(s => s.id!)));
        }
        setSelectAll(!selectAll);
    };

    const toggleSelectStatement = (id: number) => {
        const newSelected = new Set(selectedStatements);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedStatements(newSelected);
        setSelectAll(newSelected.size === statements.length);
    };

    const updatePaginationLimit = (newLimit: number) => {
        setPagination(prev => ({
            ...prev,
            limit: newLimit,
            page: 1, // Reset to first page when changing limit
        }));
    };

    // Load initial data
    useEffect(() => {
        fetchStatements();
    }, [fetchStatements]);

    return {
        statements,
        loading,
        error,
        pagination,
        filters,
        selectedStatements,
        selectAll,
        formData,
        setError,
        setFilters,
        setFormData,
        fetchStatements,
        createStatement,
        updateStatement,
        deleteStatement,
        deleteSelectedStatements,
        deleteAllStatements,
        resetForm,
        toggleSelectAll,
        toggleSelectStatement,
        updatePaginationLimit,
    };
}
