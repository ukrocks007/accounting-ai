import React from 'react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedData: Record<string, unknown>[];
  editingRow: number | null;
  isConfirming: boolean;
  onDeleteRow: (index: number) => void;
  onEditRow: (index: number, field: string, value: string) => void;
  onConfirm: () => void;
  onSetEditingRow: (row: number | null) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  extractedData,
  editingRow,
  isConfirming,
  onDeleteRow,
  onEditRow,
  onConfirm,
  onSetEditingRow,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-medium">Review Extracted Data</h3>
          <p className="text-sm text-gray-600">
            Please review the extracted data below. You can edit or delete rows as needed.
          </p>
        </div>
        
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  {extractedData.length > 0 && Object.keys(extractedData[0]).map((key) => (
                    <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {extractedData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key} className="px-4 py-2 border-b text-sm">
                        {editingRow === index ? (
                          <input
                            type="text"
                            value={String(value)}
                            onChange={(e) => onEditRow(index, key, e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            onBlur={() => onSetEditingRow(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSetEditingRow(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span 
                            onClick={() => onSetEditingRow(index)}
                            className="cursor-pointer hover:bg-gray-100 block p-1 rounded"
                          >
                            {String(value)}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 border-b text-sm">
                      <button
                        onClick={() => onDeleteRow(index)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="p-6 border-t flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isConfirming ? "Confirming..." : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
