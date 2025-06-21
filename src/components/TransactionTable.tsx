import React from 'react';

interface TransactionTableProps {
  transactions: Record<string, unknown>[];
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  if (!transactions || transactions.length === 0) return null;

  // Dynamically determine columns from the first transaction
  const allColumns = Object.keys(transactions[0]);
  
  // Define preferred column order and hidden columns
  const columnPriority = ['id', 'date', 'created_at', 'description', 'amount', 'total', 'sum', 'type', 'source'];
  const hiddenColumns = ['created_at', 'updated_at']; // Hide these columns by default
  
  // Filter out hidden columns and sort by priority
  const visibleColumns = allColumns
    .filter(col => !hiddenColumns.includes(col))
    .sort((a, b) => {
      const aPriority = columnPriority.indexOf(a);
      const bPriority = columnPriority.indexOf(b);
      if (aPriority === -1 && bPriority === -1) return a.localeCompare(b);
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });
  
  // Helper function to format column names for display
  const formatColumnName = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to format cell values
  const formatCellValue = (key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>;
    }

    // Handle date formatting
    if (key.toLowerCase().includes('date') || key.toLowerCase().includes('created_at') || key.toLowerCase().includes('updated_at')) {
      try {
        return new Date(String(value)).toLocaleDateString();
      } catch {
        return String(value);
      }
    }

    // Handle amount formatting with color coding
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('sum')) {
      const numValue = parseFloat(String(value));
      if (!isNaN(numValue)) {
        // Try to determine if this is a credit or debit based on context
        const row = transactions.find(t => t[key] === value) as Record<string, unknown> | undefined;
        const rowType = row?.type as string | undefined;
        
        return (
          <span className={`font-mono ${
            key.toLowerCase().includes('amount') && rowType 
              ? (rowType === 'credit' ? 'text-green-600' : 'text-red-600')
              : 'text-gray-800'
          }`}>
            {key.toLowerCase().includes('amount') && rowType 
              ? `${rowType === 'credit' ? '+' : '-'}$${Math.abs(numValue).toFixed(2)}`
              : `$${Math.abs(numValue).toFixed(2)}`
            }
          </span>
        );
      }
    }

    // Handle type formatting with badges
    if (key.toLowerCase() === 'type' && (value === 'credit' || value === 'debit')) {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'credit' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {value === 'credit' ? 'Credit' : 'Debit'}
        </span>
      );
    }

    // Handle source with badges
    if (key.toLowerCase() === 'source') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {String(value)}
        </span>
      );
    }

    // Handle long descriptions with truncation
    if (key.toLowerCase().includes('description') && typeof value === 'string' && value.length > 50) {
      return (
        <span title={value} className="truncate block max-w-[200px]">
          {value.substring(0, 50)}...
        </span>
      );
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    // Handle numeric values (but not amounts)
    if (typeof value === 'number' && !key.toLowerCase().includes('amount')) {
      return <span className="font-mono">{value.toLocaleString()}</span>;
    }

    // Default formatting
    return String(value);
  };

  // Helper function to determine cell alignment
  const getCellAlignment = (key: string, value: unknown): string => {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('sum') || (typeof value === 'number' && !key.toLowerCase().includes('id'))) {
      return 'text-right';
    }
    if (key.toLowerCase() === 'type' || key.toLowerCase() === 'source' || typeof value === 'boolean') {
      return 'text-center';
    }
    return 'text-left';
  };

  // Helper function to get column header alignment
  const getHeaderAlignment = (key: string): string => {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('sum')) {
      return 'text-right';
    }
    if (key.toLowerCase() === 'type' || key.toLowerCase() === 'source') {
      return 'text-center';
    }
    return 'text-left';
  };

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-300 rounded-lg text-xs">
        <thead className="bg-gray-50">
          <tr>
            {visibleColumns.map((column) => (
              <th key={column} className={`px-2 py-2 ${getHeaderAlignment(column)} text-gray-600 font-medium border-b`}>
                {formatColumnName(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={(transaction.id as string | number) || index} className="hover:bg-gray-50">
              {visibleColumns.map((column) => (
                <td key={column} className={`px-2 py-2 border-b text-gray-800 ${getCellAlignment(column, transaction[column])}`}>
                  {formatCellValue(column, transaction[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-between items-center text-xs text-gray-600">
        <div>
          Showing {transactions.length} result{transactions.length !== 1 ? 's' : ''}
        </div>
        {hiddenColumns.length > 0 && allColumns.some(col => hiddenColumns.includes(col)) && (
          <div className="text-gray-500">
            Hidden columns: {hiddenColumns.filter(col => allColumns.includes(col)).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};
