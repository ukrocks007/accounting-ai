'use client';

import { useState } from 'react';
import { useStatements } from '@/hooks/useStatements';
import { CreateEditModal } from '@/components/statements/CreateEditModal';
import { Filters } from '@/components/statements/Filters';
import { StatementsTable } from '@/components/statements/StatementsTable';
import { Pagination } from '@/components/statements/Pagination';
import { StatementRow } from '@/lib/dbManager';
import { Header } from '@/components/Header';

export default function StatementsPage() {
    const statementsHook = useStatements();
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStatement, setEditingStatement] = useState<StatementRow | null>(null);

    const handleCreateStatement = async () => {
        const result = await statementsHook.createStatement();
        if (result.success) {
            setShowCreateModal(false);
        }
        return result;
    };

    const handleUpdateStatement = async () => {
        if (!editingStatement?.id) return { success: false };
        const result = await statementsHook.updateStatement(editingStatement.id);
        if (result.success) {
            setShowEditModal(false);
            setEditingStatement(null);
        }
        return result;
    };

    const handleEditStatement = (statement: StatementRow) => {
        setEditingStatement(statement);
        statementsHook.setFormData({
            date: statement.date,
            description: statement.description,
            amount: statement.amount.toString(),
            type: statement.type,
            source: statement.source || 'manual',
        });
        setShowEditModal(true);
    };

    const handleApplyFilters = () => {
        statementsHook.fetchStatements(1);
    };

    const handleResetFilters = () => {
        statementsHook.setFilters({
            startDate: '',
            endDate: '',
            type: '',
            minAmount: '',
            maxAmount: '',
        });
        statementsHook.fetchStatements(1, true);
    };

    const handlePageChange = (page: number) => {
        statementsHook.fetchStatements(page);
    };

    const handleLimitChange = (limit: number) => {
        // Update pagination limit and fetch first page
        statementsHook.updatePaginationLimit(limit);
        statementsHook.fetchStatements(1);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Header 
                title="Statements Management"
                description="Manage your financial statements and transactions"
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                {/* Error Display */}
                {statementsHook.error && (
                    <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-600">{statementsHook.error}</p>
                        <button
                            onClick={() => statementsHook.setError(null)}
                            className="text-red-500 hover:text-red-700 ml-2"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Filters */}
                <Filters
                    filters={statementsHook.filters}
                    setFilters={statementsHook.setFilters}
                    onApplyFilters={handleApplyFilters}
                    onResetFilters={handleResetFilters}
                />

                {/* Actions */}
                <div className="mb-2 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Add Statement
                        </button>
                        
                        {statementsHook.selectedStatements.size > 0 && (
                            <button
                                onClick={statementsHook.deleteSelectedStatements}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Delete Selected ({statementsHook.selectedStatements.size})
                            </button>
                        )}
                        
                        <button
                            onClick={statementsHook.deleteAllStatements}
                            className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors"
                        >
                            Delete All
                        </button>
                    </div>

                    <div className="text-sm text-gray-600">
                        Total: {statementsHook.pagination.totalCount} statements
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow">
                    <StatementsTable
                        statements={statementsHook.statements}
                        selectedStatements={statementsHook.selectedStatements}
                        selectAll={statementsHook.selectAll}
                        onToggleSelectAll={statementsHook.toggleSelectAll}
                        onToggleSelect={statementsHook.toggleSelectStatement}
                        onEdit={handleEditStatement}
                        onDelete={statementsHook.deleteStatement}
                        loading={statementsHook.loading}
                    />

                    {/* Pagination */}
                    {statementsHook.statements.length > 0 && (
                        <Pagination
                            pagination={statementsHook.pagination}
                            onPageChange={handlePageChange}
                            onLimitChange={handleLimitChange}
                        />
                    )}
                </div>
            </div>

            {/* Create Modal */}
            <CreateEditModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateStatement}
                formData={statementsHook.formData}
                setFormData={statementsHook.setFormData}
                title="Create New Statement"
                submitText="Create Statement"
            />

            {/* Edit Modal */}
            <CreateEditModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingStatement(null);
                    statementsHook.resetForm();
                }}
                onSubmit={handleUpdateStatement}
                formData={statementsHook.formData}
                setFormData={statementsHook.setFormData}
                title="Edit Statement"
                submitText="Update Statement"
            />
        </div>
    );
}
