import React from 'react';
import { StatementRow } from '@/lib/dbManager';

interface StatementsTableProps {
  statements: StatementRow[];
  selectedStatements: Set<number>;
  selectAll: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onEdit: (statement: StatementRow) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}

export const StatementsTable: React.FC<StatementsTableProps> = ({
  statements,
  selectedStatements,
  selectAll,
  onToggleSelectAll,
  onToggleSelect,
  onEdit,
  onDelete,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No statements found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={onToggleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Description
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {statements.map((statement) => (
            <tr key={statement.id} className="hover:bg-gray-50">
              <td className="px-4 py-4 whitespace-nowrap border-b">
                <input
                  type="checkbox"
                  checked={selectedStatements.has(statement.id!)}
                  onChange={() => onToggleSelect(statement.id!)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 border-b">
                {statement.id}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 border-b">
                {new Date(statement.date).toLocaleDateString()}
              </td>
              <td className="px-4 py-4 text-sm text-gray-900 border-b">
                <div className="max-w-xs truncate" title={statement.description}>
                  {statement.description}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 border-b">
                <span className={`font-mono ${
                  statement.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {statement.type === 'credit' ? '+' : '-'}${Math.abs(statement.amount).toFixed(2)}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap border-b">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  statement.type === 'credit'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {statement.type === 'credit' ? 'Credit' : 'Debit'}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 border-b">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {statement.source}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium border-b">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(statement)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(statement.id!)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
