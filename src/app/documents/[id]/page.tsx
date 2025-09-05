'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Editor from '@/components/Editor';
import TableEditor from '@/components/TableEditor';
import ExcelEditor from '@/components/ExcelEditor';
import dynamic from 'next/dynamic';
import { 
  ArrowLeft, Edit, Download, Share2, Printer, 
  MoreVertical, Trash2, Copy, FileText, 
  Calendar, User, Eye, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { generateQRCode } from '@/lib/qrCode';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
});

export default function ViewDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDocument();
      generateDocumentQR();
    }
  }, [params.id]);

  const fetchDocument = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocument(data);
      } else {
        toast.error('Document not found');
        router.push('/documents');
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
      const url = `${window.location.origin}/documents/${params.id}`;
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
        const a = document.createElement('a');
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

  const handleShare = async () => {
    const url = `${window.location.origin}/documents/${params.id}`;
    
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
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/documents/${params.id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handlePrint = () => {
    window.print();
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
        router.push('/documents');
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

  const renderDocumentContent = () => {
    if (!document) return null;

    switch (document.type) {
      case 'text':
        return (
          <div className="prose max-w-none">
            <Editor content={document.editorState} editable={false} />
          </div>
        );
      case 'table':
        return (
          <TableEditor 
            data={document.editorState || { rows: [], columns: [] }}
            editable={false}
          />
        );
      case 'excel':
        return (
          <ExcelEditor 
            data={document.editorState || []}
            editable={false}
          />
        );
      case 'pdf':
        if (document.fileUrl) {
          return <PDFViewer fileUrl={document.fileUrl} title={document.title} />;
        } else {
          const pdfData = document.editorState;
          return (
            <div className="bg-white p-8 shadow-lg rounded-lg max-w-4xl mx-auto" style={{ minHeight: '800px' }}>
              {pdfData?.header && (
                <div className="text-center border-b pb-4 mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">{pdfData.header}</h1>
                </div>
              )}
              
              <div className="prose max-w-none flex-grow" dangerouslySetInnerHTML={{ __html: pdfData?.content || '' }} />
              
              {pdfData?.footer && (
                <div className="text-center border-t pt-4 mt-8">
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
              className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
            />
          </div>
        );
      default:
        return (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p>Unsupported document type</p>
          </div>
        );
    }
  };

  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER' || document?.createdBy?.id === user?.id;
  const canDelete = user?.role === 'ADMIN' || user?.role === 'MANAGER' || document?.createdBy?.id === user?.id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
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
          <Button onClick={() => router.push('/documents')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
              <div className="flex items-center gap-4 mt-1">
                <Badge variant="secondary" className="capitalize">
                  {document.type}
                </Badge>
                <span className="text-sm text-gray-500">
                  Version {document.version}
                </span>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {new Date(document.updatedAt).toLocaleDateString()}
                </div>
                {document.createdBy && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <User className="h-3 w-3" />
                    {document.createdBy?.name || document.createdBy?.email}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button onClick={() => router.push(`/documents/${params.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <Separator />
                    <DropdownMenuItem 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div id="printable-content">
                  {renderDocumentContent()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 print:hidden">
            <div className="space-y-6">
              {/* Document Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Document Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</div>
                      <div className="text-sm font-medium text-gray-900 mt-1 capitalize">{document.type}</div>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        {new Date(document.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Modified</div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        {new Date(document.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {document.createdBy && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</div>
                        <div className="text-sm font-medium text-gray-900 mt-1">
                          {document.createdBy?.name || document.createdBy?.email || 'Unknown'}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canEdit && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => router.push(`/documents/${params.id}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Document
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleDownloadPDF}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Document
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handlePrint}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Document
                  </Button>
                </CardContent>
              </Card>

              {/* QR Code */}
              {qrCode && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Share QR Code</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="bg-white p-3 rounded-lg border border-gray-200 inline-block">
                        <img src={qrCode} alt="QR Code" className="w-32 h-32" />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Scan to view document
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}