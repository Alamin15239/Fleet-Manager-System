'use client';

import { useState, useRef } from 'react';
// import * as XLSX from 'xlsx'; // Removed due to security vulnerability
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Download } from 'lucide-react';

interface ExcelEditorProps {
  data?: any[][];
  onChange?: (data: any[][]) => void;
  editable?: boolean;
}

export default function ExcelEditor({ data = [], onChange, editable = true }: ExcelEditorProps) {
  const [sheetData, setSheetData] = useState<any[][]>(
    data.length > 0 ? data : [
      ['Header 1', 'Header 2', 'Header 3'],
      ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
      ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
    ]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...sheetData];
    newData[rowIndex][colIndex] = value;
    setSheetData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').map(row => row.split(','));
        setSheetData(rows);
        if (onChange) {
          onChange(rows);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    const csvContent = sheetData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const addRow = () => {
    const newRow = new Array(sheetData[0]?.length || 3).fill('');
    const newData = [...sheetData, newRow];
    setSheetData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const addColumn = () => {
    const newData = sheetData.map(row => [...row, '']);
    setSheetData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex gap-2 flex-wrap p-3 bg-gray-50/50 border border-gray-200 rounded-lg">
          <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" className="h-8">
            <Upload className="h-4 w-4 mr-1" />
            Upload CSV
          </Button>
          <Button onClick={handleDownload} size="sm" variant="outline" className="h-8">
            <Download className="h-4 w-4 mr-1" />
            Download CSV
          </Button>
          <Button onClick={addRow} size="sm" variant="outline" className="h-8">
            Add Row
          </Button>
          <Button onClick={addColumn} size="sm" variant="outline" className="h-8">
            Add Column
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}
      <div className="border border-gray-200 rounded-lg overflow-auto max-h-96 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <tbody>
            {sheetData.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-50' : 'hover:bg-gray-50/50'}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="border border-gray-200 p-2 min-w-[120px] resize-x overflow-hidden relative" style={{resize: 'horizontal', minWidth: '120px', maxWidth: '400px'}}>
                    {editable ? (
                      <Input
                        value={cell || ''}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        className="border-none p-1 h-auto bg-transparent focus:bg-white focus:shadow-sm"
                      />
                    ) : (
                      <span className="text-sm">{cell}</span>
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