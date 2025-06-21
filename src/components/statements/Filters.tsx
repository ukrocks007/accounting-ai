import React from 'react';

interface FiltersProps {
  filters: {
    startDate: string;
    endDate: string;
    type: string;
    minAmount: string;
    maxAmount: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    startDate: string;
    endDate: string;
    type: string;
    minAmount: string;
    maxAmount: string;
  }>>;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

export const Filters: React.FC<FiltersProps> = ({
  filters,
  setFilters,
  onApplyFilters,
  onResetFilters,
}) => {
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-gray-50 p-2 rounded-lg mb-3">
      <h3 className="text-lg font-medium mb-4">Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Amount
          </label>
          <input
            type="number"
            step="0.01"
            value={filters.minAmount}
            onChange={(e) => handleFilterChange('minAmount', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Amount
          </label>
          <input
            type="number"
            step="0.01"
            value={filters.maxAmount}
            onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <button
          onClick={onApplyFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Apply Filters
        </button>
        <button
          onClick={onResetFilters}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};
