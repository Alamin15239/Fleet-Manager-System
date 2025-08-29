'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  fileUrl: string;
  title?: string;
}

export default function PDFViewer({ fileUrl, title }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 2.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = title ? `${title}.pdf` : 'document.pdf';
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2 p-3 bg-gray-50/50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Button onClick={goToPrevPage} disabled={pageNumber <= 1} size="sm" variant="outline" className="h-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2">
            Page {pageNumber} of {numPages}
          </span>
          <Button onClick={goToNextPage} disabled={pageNumber >= numPages} size="sm" variant="outline" className="h-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={zoomOut} size="sm" variant="outline" className="h-8 w-8 p-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
          <Button onClick={zoomIn} size="sm" variant="outline" className="h-8 w-8 p-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={downloadPDF} size="sm" variant="outline" className="h-8">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-auto max-h-[600px] bg-white shadow-sm">
        <div className="flex justify-center p-4">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="p-8 text-center text-gray-500">Loading PDF...</div>}
            error={<div className="p-8 text-center text-red-500">Error loading PDF</div>}
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              loading={<div className="p-4 text-center text-gray-500">Loading page...</div>}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>
    </div>
  );
}