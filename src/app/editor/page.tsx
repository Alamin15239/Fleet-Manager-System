'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Editor from '@/components/Editor';
import TableEditor from '@/components/TableEditor';
import ExcelEditor from '@/components/ExcelEditor';
import AdvancedPDFEditor from '@/components/AdvancedPDFEditor';
import { Save, FileText, Table, FileSpreadsheet, Upload, List } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export default function EditorPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<'text' | 'table' | 'excel' | 'pdf'>('text');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [editorContent, setEditorContent] = useState(null);
  const [tableData, setTableData] = useState({ rows: [], columns: [] });
  const [excelData, setExcelData] = useState([]);
  const [pdfData, setPdfData] = useState({ header: '', content: '', footer: '', pageSettings: {} });

  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // Check authentication and role
  useEffect(() => {
    checkAuth();
  }, [router]);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const user = await response.json();
        setUserRole(user.role);
        localStorage.setItem('userId', user.id);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      console.log('Save attempt - Token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        toast.error('Authentication required. Please login again.');
        router.push('/login');
        return;
      }
      
      let editorState = null;

      if (documentType === 'text') {
        editorState = editorContent;
      } else if (documentType === 'table') {
        editorState = tableData;
      } else if (documentType === 'excel') {
        editorState = excelData;
      } else if (documentType === 'pdf') {
        editorState = pdfData && Object.keys(pdfData).length > 0 ? pdfData : { header: '', content: '', footer: '', pageSettings: {} };
      }

      const payload = {
        title,
        type: documentType,
        editorState,
        orientation
      };
      
      console.log('Save payload:', {
        title,
        type: documentType,
        editorStateType: typeof editorState,
        editorStateContent: editorState,
        orientation
      });

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (response.ok) {
        const document = JSON.parse(responseText);
        console.log('Document saved successfully:', document.id);
        toast.success('Document saved successfully');
        fetchDocuments();
        // Clear form
        setTitle('');
        setEditorContent('');
        setTableData({ rows: [], columns: [] });
        setExcelData([]);
        setPdfData({ header: '', content: '', footer: '', pageSettings: {} });
      } else {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText };
        }
        console.error('Save failed:', errorData);
        toast.error(errorData.error || 'Failed to save document');
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('Network error - check connection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const uploadedFile = await response.json();
        
        const docResponse = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: uploadedFile.originalName,
            type: uploadedFile.type.includes('pdf') ? 'pdf' : 'image',
            fileUrl: uploadedFile.url
          })
        });

        if (docResponse.ok) {
          const document = await docResponse.json();
          toast.success('File uploaded successfully');
          router.push(`/document/${document.id}`);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error uploading file');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Document Editor</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Create and manage your documents with rich editing capabilities</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="border-b border-gray-200 bg-white">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  Create Document
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium">Document Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter document title..."
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-sm font-medium">Document Type</Label>
                    <Select value={documentType} onValueChange={(value: any) => setDocumentType(value)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Rich Text
                          </div>
                        </SelectItem>
                        <SelectItem value="table">
                          <div className="flex items-center gap-2">
                            <Table className="h-4 w-4" />
                            Table
                          </div>
                        </SelectItem>
                        <SelectItem value="excel">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Excel
                          </div>
                        </SelectItem>
                        <SelectItem value="pdf">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            PDF
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orientation" className="text-sm font-medium">Page Orientation</Label>
                    <Select value={orientation} onValueChange={(value: any) => setOrientation(value)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-4 border border-gray-400 rounded-sm" />
                            Portrait
                          </div>
                        </SelectItem>
                        <SelectItem value="landscape">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-3 border border-gray-400 rounded-sm" />
                            Landscape
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs value={documentType} onValueChange={(value: any) => setDocumentType(value)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
                    <TabsTrigger value="text" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                      {isMobile ? 'Text' : 'Rich Text'}
                    </TabsTrigger>
                    <TabsTrigger value="table" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <Table className="h-3 w-3 sm:h-4 sm:w-4" />
                      Table
                    </TabsTrigger>
                    <TabsTrigger value="excel" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4" />
                      Excel
                    </TabsTrigger>
                    <TabsTrigger value="pdf" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                      PDF
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="mt-4 sm:mt-6">
                    <Editor content={editorContent} onChange={setEditorContent} />
                  </TabsContent>
                  <TabsContent value="table" className="mt-4 sm:mt-6">
                    <TableEditor 
                      data={tableData}
                      onChange={setTableData} 
                    />
                  </TabsContent>
                  <TabsContent value="excel" className="mt-4 sm:mt-6">
                    <ExcelEditor data={excelData} onChange={setExcelData} />
                  </TabsContent>
                  <TabsContent value="pdf" className="mt-4 sm:mt-6">
                    <AdvancedPDFEditor 
                      initialData={pdfData}
                      onChange={setPdfData}
                    />
                    <div className="flex gap-2 mt-4">
                      <Button onClick={() => window.document.getElementById('file-upload')?.click()} variant="outline" size="sm" className="w-full sm:w-auto">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload PDF
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                  <Button onClick={handleSave} disabled={isLoading} className="h-10 w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? 'Saving...' : (isMobile ? 'Save' : 'Save Document')}
                  </Button>
                  {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                    <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()} className="h-10 w-full sm:w-auto">
                      <Upload className="h-4 w-4 mr-2" />
                      {isMobile ? 'Upload' : 'Upload File'}
                    </Button>
                  )}
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Document List */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <List className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    {isMobile ? 'Recent' : 'Recent Documents'}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => router.push('/documents')}>
                    {isMobile ? 'All' : 'View All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No documents yet</p>
                      <p className="text-xs text-gray-400">Create your first document</p>
                    </div>
                  ) : (
                    documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                        onClick={() => router.push(`/document/${doc.id}`)}
                      >
                        <div className="font-medium text-sm truncate text-gray-900">{doc.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-1 rounded">{doc.type}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          <div className="truncate">Created: {new Date(doc.createdAt).toLocaleDateString()}</div>
                          {!isMobile && (
                            <div className="mt-1">v{doc.version} • Updated: {new Date(doc.updatedAt).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}