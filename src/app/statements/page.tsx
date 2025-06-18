'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

export default function StatementsPage() {
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

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: '',
        minAmount: '',
        maxAmount: '',
    });

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStatement, setEditingStatement] = useState<StatementRow | null>(null);

    // Selection states
    const [selectedStatements, setSelectedStatements] = useState<Set<number>>(new Set());
    const [selectAll, setSelectAll] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        date: '',
        description: '',
        amount: '',
        type: 'debit' as 'credit' | 'debit',
        source: 'manual',
    });

    // Fetch statements
    const fetchStatements = async (page = 1, resetFilters = false) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
            });            const currentFilters = resetFilters ? { startDate: '', endDate: '', type: '', minAmount: '', maxAmount: '' } : filters;
            
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
        } catch (err) {
            setError('Network error occurred');
        } finally {
            setLoading(false);
        }
    };

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
                setShowCreateModal(false);
                resetForm();
                fetchStatements(pagination.page);
            } else {
                setError(data.error || 'Failed to create statement');
            }
        } catch (err) {
            setError('Network error occurred');
        }
    };

    // Update statement
    const updateStatement = async () => {
        if (!editingStatement) return;

        try {
            const response = await fetch(`/api/statements/${editingStatement.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                setShowEditModal(false);
                setEditingStatement(null);
                resetForm();
                fetchStatements(pagination.page);
            } else {
                setError(data.error || 'Failed to update statement');
            }
        } catch (err) {
            setError('Network error occurred');
        }
    };

    // Delete statement
    const deleteStatement = async (id: number) => {
        if (!confirm('Are you sure you want to delete this statement?')) return;

        try {
            const response = await fetch(`/api/statements/${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                fetchStatements(pagination.page);
            } else {
                setError(data.error || 'Failed to delete statement');
            }
        } catch (err) {
            setError('Network error occurred');
        }
    };

    // Delete selected statements
    const deleteSelectedStatements = async () => {
        if (selectedStatements.size === 0) {
            setError('No statements selected');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedStatements.size} selected statements?`)) return;

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
            } else {
                setError(data.error || 'Failed to delete selected statements');
            }
        } catch (err) {
            setError('Network error occurred');
        }
    };

    // Delete all statements
    const deleteAllStatements = async () => {
        if (!confirm('Are you sure you want to delete ALL statements? This action cannot be undone.')) return;

        try {
            const response = await fetch('/api/statements?deleteAll=true', {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                setSelectedStatements(new Set());
                setSelectAll(false);
                fetchStatements(1);
            } else {
                setError(data.error || 'Failed to delete all statements');
            }
        } catch (err) {
            setError('Network error occurred');
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            date: '',
            description: '',
            amount: '',
            type: 'debit',
            source: 'manual',
        });
    };

    // Open edit modal
    const openEditModal = (statement: StatementRow) => {
        setEditingStatement(statement);
        setFormData({
            date: statement.date,
            description: statement.description,
            amount: statement.amount.toString(),
            type: statement.type,
            source: statement.source || 'manual',
        });
        setShowEditModal(true);
    };

    // Handle filter changes
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Apply filters
    const applyFilters = () => {
        fetchStatements(1);
    };

    // Clear filters
    const clearFilters = () => {
        setFilters({ startDate: '', endDate: '', type: '', minAmount: '', maxAmount: '' });
        fetchStatements(1, true);
    };

    // Handle individual selection
    const handleStatementSelect = (id: number, checked: boolean) => {
        const newSelected = new Set(selectedStatements);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedStatements(newSelected);
        setSelectAll(newSelected.size === statements.length && statements.length > 0);
    };

    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(statements.map(stmt => stmt.id!).filter(id => id !== undefined));
            setSelectedStatements(allIds);
        } else {
            setSelectedStatements(new Set());
        }
        setSelectAll(checked);
    };

    // Reset selections when statements change
    useEffect(() => {
        setSelectedStatements(new Set());
        setSelectAll(false);
    }, [statements]);

    useEffect(() => {
        fetchStatements();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-300">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Statements Management</h1>
                            <p className="text-gray-600 text-sm">Manage your financial statements with full CRUD operations</p>
                        </div>
                        <nav className="flex gap-4">
                            <Link
                                href="/"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                Back to Home
                            </Link>
                            <Link
                                href="/admin/background-processing"
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                            >
                                Admin Panel
                            </Link>
                        </nav>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-white rounded-lg shadow-sm">
                    {/* Page Header */}
                    <div className="border-b border-gray-200 px-6 py-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">All Statements</h2>
                                {selectedStatements.size > 0 && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {selectedStatements.size} statement{selectedStatements.size > 1 ? 's' : ''} selected
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {selectedStatements.size > 0 && (
                                    <button
                                        onClick={deleteSelectedStatements}
                                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                                    >
                                        Delete Selected ({selectedStatements.size})
                                    </button>
                                )}
                                <button
                                    onClick={deleteAllStatements}
                                    className="bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 transition-colors"
                                >
                                    Delete All
                                </button>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Add Statement
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                    value={filters.type}
                                    onChange={(e) => handleFilterChange('type', e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Types</option>
                                    <option value="credit">Credit</option>
                                    <option value="debit">Debit</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={filters.minAmount}
                                    onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                                    placeholder="Minimum amount..."
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={filters.maxAmount}
                                    onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                                    placeholder="Maximum amount..."
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={applyFilters}
                                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                                >
                                    Apply
                                </button>
                                <button
                                    onClick={clearFilters}
                                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-800">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="mt-2 text-red-600 hover:text-red-800 text-sm"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <input
                                            type="checkbox"
                                            checked={selectAll}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center">
                                            <div className="flex justify-center items-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                <span className="ml-2">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : statements.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                            No statements found
                                        </td>
                                    </tr>
                                ) : (
                                    statements.map((statement) => (
                                        <tr key={statement.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStatements.has(statement.id!)}
                                                    onChange={(e) => handleStatementSelect(statement.id!, e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {new Date(statement.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={statement.description}>
                                                {statement.description}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className={`font-medium ${statement.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {statement.type === 'credit' ? '+' : '-'}${Math.abs(statement.amount).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statement.type === 'credit'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {statement.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => openEditModal(statement)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteStatement(statement.id!)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && statements.length > 0 && (
                        <div className="px-6 py-4 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                    {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                                    {pagination.totalCount} results
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => fetchStatements(pagination.page - 1)}
                                        disabled={!pagination.hasPrevPage}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-700">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => fetchStatements(pagination.page + 1)}
                                        disabled={!pagination.hasNextPage}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Create Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h2 className="text-xl font-semibold mb-4">Create New Statement</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'credit' | 'debit' }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="debit">Debit</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                                {/* <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                                    <input
                                        type="text"
                                        value={formData.source}
                                        onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div> */}
                            </div>
                            <div className="flex justify-end space-x-2 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createStatement}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h2 className="text-xl font-semibold mb-4">Edit Statement</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'credit' | 'debit' }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="debit">Debit</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                                {/* <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                                    <input
                                        type="text"
                                        value={formData.source}
                                        onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div> */}
                            </div>
                            <div className="flex justify-end space-x-2 mt-6">
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingStatement(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={updateStatement}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
