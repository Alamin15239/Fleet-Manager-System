'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Editor from '@/components/Editor';
import TableEditor from '@/components/TableEditor';
import ExcelEditor from '@/components/ExcelEditor';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
});
import { FileText, Download, Edit, Printer, Share2, ArrowLeft, Eye, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { generateQRCode } from '@/lib/qrCode';

export default function DocumentViewPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDocument();
      generateDocumentQR();
    }
  }, [params.id]);

  const fetchDocument = async () => {
    try {
      const response = await fetch(`/api/documents/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setDocument(data);
      } else {
        toast.error('Document not found');
        router.push('/editor');
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error('Error loading document');
    } finally {
      setIsLoading(false);
    }
  };

  const generateDocumentQR = async () => {
    try {
      const url = `${window.location.origin}/document/${params.id}`;
      const qrDataUrl = await generateQRCode(url);
      setQrCode(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/pdf/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${document?.title || 'document'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('PDF downloaded successfully');
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error downloading PDF');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${params.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Document deleted successfully');
        router.push('/editor');
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error deleting document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
  };

  const handleSaveAs = async (format: 'pdf' | 'html' | 'json') => {
    try {
      if (format === 'pdf') {
        await handleDownloadPDF();
        return;
      }

      let content = '';
      let filename = `${document?.title || 'document'}`;
      let mimeType = 'text/plain';

      if (format === 'html') {
        content = `<!DOCTYPE html><html><head><title>${document?.title}</title></head><body>${renderDocumentAsHTML()}</body></html>`;
        filename += '.html';
        mimeType = 'text/html';
      } else if (format === 'json') {
        content = JSON.stringify(document, null, 2);
        filename += '.json';
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Document saved as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Error saving document');
    }
  };

  const renderDocumentAsHTML = () => {
    if (!document) return '';
    
    switch (document.type) {
      case 'text':
        return '<div>' + (document.editorState || '') + '</div>';
      case 'pdf':
        const pdfData = document.editorState;
        let html = '<div style="padding: 2rem; max-width: 800px; margin: 0 auto;">';
        if (pdfData?.header) {
          html += `<div style="text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 1rem; margin-bottom: 2rem;"><h1>${pdfData.header}</h1></div>`;
        }
        html += `<div>${pdfData?.content || ''}</div>`;
        if (pdfData?.footer) {
          html += `<div style="text-align: center; border-top: 1px solid #ccc; padding-top: 1rem; margin-top: 2rem;"><p>${pdfData.footer.replace('{page}', '1')}</p></div>`;
        }
        html += '</div>';
        return html;
      case 'table':
      case 'excel':
        const data = document.editorState;
        if (Array.isArray(data)) {
          return '<table border="1">' + data.map(row => 
            '<tr>' + (Array.isArray(row) ? row.map(cell => `<td>${cell}</td>`).join('') : `<td>${row}</td>`) + '</tr>'
          ).join('') + '</table>';
        }
        return '<div>Table data</div>';
      default:
        return '<div>Document content</div>';
    }
  };

  const handlePrint = () => {
    const printContent = window.document.getElementById('printable-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      printWindow?.document.write(`
        <html>
          <head>
            <title>${document?.title || 'Document'}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; min-height: 100vh; display: flex; flex-direction: column; }
              .prose { max-width: none; }
              .flex { display: flex; }
              .flex-col { flex-direction: column; }
              .flex-grow { flex-grow: 1; }
              .mt-auto { margin-top: auto; }
              @media print { 
                body { margin: 0; min-height: 100vh; } 
                .footer { position: fixed; bottom: 0; width: 100%; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow?.document.close();
      printWindow?.print();
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/document/${params.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: document?.title,
          url: url
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  const renderDocumentContent = () => {
    if (!document) return null;

    switch (document.type) {
      case 'text':
        return <Editor content={document.editorState} editable={false} />;
      case 'table':
        return (
          <TableEditor 
            data={document.editorState?.rows || []} 
            columns={document.editorState?.columns || []}
            editable={false}
          />
        );
      case 'excel':
        return <ExcelEditor data={document.editorState || []} editable={false} />;
      case 'pdf':
        if (document.fileUrl) {
          return <PDFViewer fileUrl={document.fileUrl} title={document.title} />;
        } else {
          // Render PDF content created with editor
          const pdfData = document.editorState;
          return (
            <div className="bg-white p-8 shadow-lg rounded-lg max-w-4xl mx-auto flex flex-col" style={{ minHeight: '800px' }}>
              {/* Header */}
              {pdfData?.header && (
                <div className="text-center border-b pb-4 mb-6">
                  <h1 className="text-xl font-bold text-gray-900">{pdfData.header}</h1>
                </div>
              )}
              
              {/* Content */}
              <div className="prose max-w-none flex-grow" dangerouslySetInnerHTML={{ __html: pdfData?.content || '' }} />
              
              {/* Footer */}
              {pdfData?.footer && (
                <div className="text-center border-t pt-4 mt-auto">
                  <p className="text-sm text-gray-600">{pdfData.footer.replace('{page}', '1')}</p>
                </div>
              )}
            </div>
          );
        }
      case 'image':
        return (
          <div className="text-center">
            <img 
              src={document.fileUrl} 
              alt={document.title}
              className="max-w-full h-auto mx-auto rounded-lg"
            />
          </div>
        );
      default:
        return <div>Unsupported document type</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Document not found</h2>
          <p className="text-gray-600 mb-4">The document you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => router.push('/editor')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Editor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <FileText className="h-5 w-5 text-blue-600" />
                        {document.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="capitalize">
                          {document.type}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          Version {document.version}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handlePreview} className="h-9">
                      <Eye className="h-4 w-4 mr-1" />
                      {showPreview ? 'Hide Preview' : 'Preview'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push('/editor')} className="h-9">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
                      <Printer className="h-4 w-4 mr-1" />
                      Print
                    </Button>
                    <div className="relative group">
                      <Button variant="outline" size="sm" className="h-9">
                        <Save className="h-4 w-4 mr-1" />
                        Save As
                      </Button>
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <div className="py-1">
                          <button onClick={() => handleSaveAs('pdf')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
                            Save as PDF
                          </button>
                          <button onClick={() => handleSaveAs('html')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
                            Save as HTML
                          </button>
                          <button onClick={() => handleSaveAs('json')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
                            Save as JSON
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleShare} className="h-9">
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                    <Button onClick={handleDownloadPDF} className="h-9">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting} className="h-9">
                      <Trash2 className="h-4 w-4 mr-1" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {showPreview && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">Preview Mode</h3>
                    <div className="text-sm text-blue-700">
                      This is how your document will appear when printed or exported.
                    </div>
                  </div>
                )}
                <div className={`print:shadow-none ${showPreview ? 'border border-gray-300 rounded-lg p-4 bg-white shadow-sm' : ''}`} id="printable-content">
                  {renderDocumentContent()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 print:hidden">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="border-b border-gray-200 bg-white">
                <CardTitle className="text-lg">Document Info</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{new Date(document.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Modified</div>
                    <div className="text-sm font-medium text-gray-900 mt-1">{new Date(document.updatedAt).toLocaleDateString()}</div>
                  </div>
                  {document.createdBy && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</div>
                      <div className="text-sm font-medium text-gray-900 mt-1">{document.createdBy.name || document.createdBy.email}</div>
                    </div>
                  )}
                </div>
                {qrCode && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">QR Code</div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 inline-block">
                        <img src={qrCode} alt="QR Code" className="w-32 h-32" />
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Scan to view online
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}