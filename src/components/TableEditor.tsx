'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TableEditorProps {
  data?: any;
  onChange?: (data: any) => void;
  editable?: boolean;
}

export default function TableEditor({ data, onChange, editable = true }: TableEditorProps) {
  const isMobile = useIsMobile();
  const [tableData, setTableData] = useState(() => {
    if (data && data.rows && data.columns) {
      return data;
    }
    return {
      rows: [['Cell 1', 'Cell 2'], ['Cell 3', 'Cell 4']],
      columns: ['Column 1', 'Column 2']
    };
  });

  const updateData = (newData: any) => {
    setTableData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const addRow = () => {
    const newRow = new Array(tableData.columns.length).fill('');
    const newData = {
      ...tableData,
      rows: [...tableData.rows, newRow]
    };
    updateData(newData);
  };

  const removeRow = () => {
    if (tableData.rows.length > 1) {
      const newData = {
        ...tableData,
        rows: tableData.rows.slice(0, -1)
      };
      updateData(newData);
    }
  };

  const addColumn = () => {
    const newColumns = [...tableData.columns, `Column ${tableData.columns.length + 1}`];
    const newRows = tableData.rows.map(row => [...row, '']);
    const newData = {
      rows: newRows,
      columns: newColumns
    };
    updateData(newData);
  };

  const removeColumn = () => {
    if (tableData.columns.length > 1) {
      const newColumns = tableData.columns.slice(0, -1);
      const newRows = tableData.rows.map(row => row.slice(0, -1));
      const newData = {
        rows: newRows,
        columns: newColumns
      };
      updateData(newData);
    }
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...tableData.rows];
    newRows[rowIndex][colIndex] = value;
    const newData = {
      ...tableData,
      rows: newRows
    };
    updateData(newData);
  };

  const updateColumnName = (colIndex: number, name: string) => {
    const newColumns = [...tableData.columns];
    newColumns[colIndex] = name;
    const newData = {
      ...tableData,
      columns: newColumns
    };
    updateData(newData);
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="grid grid-cols-2 sm:flex gap-2 p-3 bg-gray-50/50 border border-gray-200 rounded-lg">
          <Button onClick={addRow} size="sm" variant="outline" className={`${isMobile ? 'h-7 text-xs' : 'h-8'}`}>
            <Plus className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'}`} />
            {isMobile ? '+ Row' : 'Add Row'}
          </Button>
          <Button onClick={removeRow} size="sm" variant="outline" className={`${isMobile ? 'h-7 text-xs' : 'h-8'}`}>
            <Trash2 className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'}`} />
            {isMobile ? '- Row' : 'Remove Row'}
          </Button>
          <Button onClick={addColumn} size="sm" variant="outline" className={`${isMobile ? 'h-7 text-xs' : 'h-8'}`}>
            <Plus className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'}`} />
            {isMobile ? '+ Col' : 'Add Column'}
          </Button>
          <Button onClick={removeColumn} size="sm" variant="outline" className={`${isMobile ? 'h-7 text-xs' : 'h-8'}`}>
            <Trash2 className={`${isMobile ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1'}`} />
            {isMobile ? '- Col' : 'Remove Column'}
          </Button>
        </div>
      )}
      <div className="border border-gray-200 rounded-lg overflow-auto bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {tableData.columns.map((col: string, colIndex: number) => (
                <th key={colIndex} className={`border border-gray-200 ${isMobile ? 'p-1 min-w-[100px]' : 'p-2 min-w-[120px]'}`}>
                  {editable ? (
                    <Input
                      value={col}
                      onChange={(e) => updateColumnName(colIndex, e.target.value)}
                      className={`border-none ${isMobile ? 'p-0.5 text-xs' : 'p-1'} h-auto bg-transparent font-medium text-center`}
                      placeholder={`Column ${colIndex + 1}`}
                    />
                  ) : (
                    <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{col}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row: string[], rowIndex: number) => (
              <tr key={rowIndex} className="hover:bg-gray-50/50">
                {row.map((cell: string, colIndex: number) => (
                  <td key={colIndex} className={`border border-gray-200 ${isMobile ? 'p-1' : 'p-2'}`}>
                    {editable ? (
                      <Input
                        value={cell || ''}
                        onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                        className={`border-none ${isMobile ? 'p-0.5 text-xs' : 'p-1'} h-auto bg-transparent`}
                        placeholder="Enter text"
                      />
                    ) : (
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{cell}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}