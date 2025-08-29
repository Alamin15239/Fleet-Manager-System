'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      setSheetData(jsonData as any[][]);
      if (onChange) {
        onChange(jsonData as any[][]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownload = () => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, 'document.xlsx');
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
            Upload Excel
          </Button>
          <Button onClick={handleDownload} size="sm" variant="outline" className="h-8">
            <Download className="h-4 w-4 mr-1" />
            Download Excel
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
            accept=".xlsx,.xls,.csv"
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
                  <td key={colIndex} className="border border-gray-200 p-2 min-w-[120px]">
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