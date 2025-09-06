'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, Plus, Search, Filter, Grid, List, Download, Share, 
  Edit, Trash2, Copy, Star, Clock, User, Calendar, Eye,
  FileImage, Table, BarChart3, FileSpreadsheet, Image
} from 'lucide-react';
import MicrosoftWordEditor from '@/components/MicrosoftWordEditor';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  title: string;
  type: string;
  description?: string;
  content?: string;
  version: number;
  wordCount: number;
  isTemplate: boolean;
  tags: string[];
  language: string;
  createdAt: string;
  updatedAt: string;
  lastAccessed?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (type: string) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `New ${type} Document`,
          type,
          content: getDefaultContent(type),
        }),
      });

      if (response.ok) {
        const newDocument = await response.json();
        setDocuments([newDocument, ...documents]);
        setSelectedDocument(newDocument);
        setIsEditorOpen(true);
        toast({
          title: 'Success',
          description: 'Document created successfully',
        });
      }
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: 'Error',
        description: 'Failed to create document',
        variant: 'destructive',
      });
    }
  };

  const saveDocument = async (documentId: string, title: string, content: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          wordCount: content.replace(/<[^>]*>/g, '').split(/\s+/).length,
        }),
      });

      if (response.ok) {
        const updatedDocument = await response.json();
        setDocuments(documents.map(doc => 
          doc.id === documentId ? updatedDocument : doc
        ));
        toast({
          title: 'Success',
          description: 'Document saved successfully',
        });
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: 'Error',
        description: 'Failed to save document',
        variant: 'destructive',
      });
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId));
        toast({
          title: 'Success',
          description: 'Document deleted successfully',
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const exportDocument = async (documentId: string, format: string) => {
    try {
      const response = await fetch('/api/documents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, format }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `document.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to export document',
        variant: 'destructive',
      });
    }
  };

  const getDefaultContent = (type: string): string => {
    switch (type) {
      case 'report':
        return '<h1>Report Title</h1><p>Executive Summary</p><h2>Introduction</h2><p>Content goes here...</p>';
      case 'letter':
        return '<p>Date: ' + new Date().toLocaleDateString() + '</p><p>Dear [Recipient],</p><p>Content goes here...</p><p>Sincerely,<br/>[Your Name]</p>';
      case 'memo':
        return '<h2>MEMORANDUM</h2><p><strong>TO:</strong> [Recipient]</p><p><strong>FROM:</strong> [Your Name]</p><p><strong>DATE:</strong> ' + new Date().toLocaleDateString() + '</p><p><strong>SUBJECT:</strong> [Subject]</p><p>Content goes here...</p>';
      case 'invoice':
        return '<h1>INVOICE</h1><p><strong>Invoice #:</strong> INV-001</p><p><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</p><table style="width: 100%; border-collapse: collapse;"><tr><th style="border: 1px solid #ddd; padding: 8px;">Description</th><th style="border: 1px solid #ddd; padding: 8px;">Quantity</th><th style="border: 1px solid #ddd; padding: 8px;">Price</th><th style="border: 1px solid #ddd; padding: 8px;">Total</th></tr><tr><td style="border: 1px solid #ddd; padding: 8px;">Item 1</td><td style="border: 1px solid #ddd; padding: 8px;">1</td><td style="border: 1px solid #ddd; padding: 8px;">$100</td><td style="border: 1px solid #ddd; padding: 8px;">$100</td></tr></table>';
      default:
        return '<h1>Document Title</h1><p>Start writing your content here...</p>';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="h-8 w-8" />;
      case 'table': return <Table className="h-8 w-8" />;
      case 'excel': return <FileSpreadsheet className="h-8 w-8" />;
      case 'image': return <Image className="h-8 w-8" />;
      case 'chart': return <BarChart3 className="h-8 w-8" />;
      default: return <FileText className="h-8 w-8" />;
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || doc.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Create, edit, and manage your documents</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <Button variant="outline" onClick={() => { createDocument('text'); setIsCreating(false); }} className="h-20 flex-col">
                <FileText className="h-8 w-8 mb-2" />
                Text Document
              </Button>
              <Button variant="outline" onClick={() => { createDocument('report'); setIsCreating(false); }} className="h-20 flex-col">
                <FileText className="h-8 w-8 mb-2" />
                Report
              </Button>
              <Button variant="outline" onClick={() => { createDocument('letter'); setIsCreating(false); }} className="h-20 flex-col">
                <FileText className="h-8 w-8 mb-2" />
                Letter
              </Button>
              <Button variant="outline" onClick={() => { createDocument('memo'); setIsCreating(false); }} className="h-20 flex-col">
                <FileText className="h-8 w-8 mb-2" />
                Memo
              </Button>
              <Button variant="outline" onClick={() => { createDocument('invoice'); setIsCreating(false); }} className="h-20 flex-col">
                <FileText className="h-8 w-8 mb-2" />
                Invoice
              </Button>
              <Button variant="outline" onClick={() => { createDocument('table'); setIsCreating(false); }} className="h-20 flex-col">
                <Table className="h-8 w-8 mb-2" />
                Table
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="report">Report</SelectItem>
            <SelectItem value="letter">Letter</SelectItem>
            <SelectItem value="memo">Memo</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="table">Table</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Documents Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-blue-600">
                    {getDocumentIcon(document.type)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDocument(document);
                        setIsEditorOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportDocument(document.id, 'pdf')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDocument(document.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg line-clamp-2">{document.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {document.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{document.type}</Badge>
                    {document.isTemplate && <Badge variant="outline">Template</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(document.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {document.wordCount} words • v{document.version}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-blue-600">
                      {getDocumentIcon(document.type)}
                    </div>
                    <div>
                      <h3 className="font-medium">{document.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {document.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{document.wordCount} words</span>
                        <span>v{document.version}</span>
                        <span>{new Date(document.updatedAt).toLocaleDateString()}</span>
                        {document.createdBy && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {document.createdBy.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{document.type}</Badge>
                    {document.isTemplate && <Badge variant="outline">Template</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDocument(document);
                        setIsEditorOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportDocument(document.id, 'pdf')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDocument(document.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterType !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first document'
            }
          </p>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Document
          </Button>
        </div>
      )}

      {/* Document Editor Modal */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-7xl h-[90vh] p-0">
          {selectedDocument && (
            <MicrosoftWordEditor
              value={selectedDocument.content || ''}
              title={selectedDocument.title}
              onChange={(content) => {
                setSelectedDocument({
                  ...selectedDocument,
                  content
                });
              }}
              onTitleChange={(title) => {
                setSelectedDocument({
                  ...selectedDocument,
                  title
                });
              }}
              onSave={() => {
                if (selectedDocument) {
                  saveDocument(selectedDocument.id, selectedDocument.title, selectedDocument.content || '');
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}