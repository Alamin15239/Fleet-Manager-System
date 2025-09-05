'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Save, Upload, ArrowLeft, Plus, 
  FileSpreadsheet, Table, Image, FileImage,
  Loader2, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

const DOCUMENT_TYPES = [
  { value: 'text', label: 'Rich Text Document', icon: FileText, description: 'Create formatted text documents' },
  { value: 'table', label: 'Table Document', icon: Table, description: 'Create structured data tables' },
  { value: 'excel', label: 'Spreadsheet', icon: FileSpreadsheet, description: 'Create Excel-like spreadsheets' },
  { value: 'pdf', label: 'PDF Document', icon: FileText, description: 'Create professional PDF documents' },
  { value: 'image', label: 'Image Document', icon: Image, description: 'Upload and manage images' }
];

const TEMPLATES = {
  text: [
    { name: 'Blank Document', content: '' },
    { name: 'Meeting Notes', content: '<h2>Meeting Notes</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><p><strong>Agenda:</strong></p><ul><li></li></ul><p><strong>Action Items:</strong></p><ul><li></li></ul>' },
    { name: 'Report Template', content: '<h1>Report Title</h1><h2>Executive Summary</h2><p></p><h2>Introduction</h2><p></p><h2>Findings</h2><p></p><h2>Recommendations</h2><p></p><h2>Conclusion</h2><p></p>' }
  ],
  table: [
    { name: 'Blank Table', data: { rows: [], columns: [] } },
    { name: 'Employee List', data: { columns: ['Name', 'Position', 'Department', 'Email'], rows: [] } },
    { name: 'Inventory Tracker', data: { columns: ['Item', 'Quantity', 'Location', 'Status'], rows: [] } }
  ],
  pdf: [
    { name: 'Blank PDF', data: { header: '', content: '', footer: '' } },
    { name: 'Business Letter', data: { header: 'Company Letterhead', content: '<p>Date: </p><p>Dear [Recipient],</p><p></p><p>Sincerely,</p><p>[Your Name]</p>', footer: 'Page {page}' } },
    { name: 'Invoice Template', data: { header: 'INVOICE', content: '<p><strong>Invoice #:</strong> </p><p><strong>Date:</strong> </p><p><strong>Bill To:</strong></p><p></p><p><strong>Description:</strong></p><p></p><p><strong>Total:</strong> $</p>', footer: 'Thank you for your business!' } }
  ]
};

export default function CreateDocumentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    type: 'text' as keyof typeof TEMPLATES,
    description: '',
    template: 'Blank Document'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateDocument = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      let editorState = null;

      // Get template data based on type and selected template
      const templates = TEMPLATES[formData.type];
      const selectedTemplate = templates?.find(t => t.name === formData.template);
      
      if (selectedTemplate) {
        if (formData.type === 'text') {
          editorState = selectedTemplate.content;
        } else if (formData.type === 'table' || formData.type === 'excel') {
          editorState = (selectedTemplate as any).data;
        } else if (formData.type === 'pdf') {
          editorState = (selectedTemplate as any).data;
        }
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          type: formData.type,
          description: formData.description,
          editorState
        })
      });

      if (response.ok) {
        const document = await response.json();
        toast.success('Document created successfully');
        router.push(`/documents/${document.id}/edit`);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create document');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only images and PDF files are allowed');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const uploadResult = await response.json();
        
        // Create document with uploaded file
        const docResponse = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ''),
            type: file.type.includes('pdf') ? 'pdf' : 'image',
            fileUrl: uploadResult.url,
            description: `Uploaded ${file.type.includes('pdf') ? 'PDF' : 'image'} file`
          })
        });

        if (docResponse.ok) {
          const document = await docResponse.json();
          toast.success('File uploaded successfully');
          router.push(`/documents/${document.id}`);
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const selectedDocType = DOCUMENT_TYPES.find(type => type.value === formData.type);
  const availableTemplates = TEMPLATES[formData.type] || [];

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Document</h1>
            <p className="text-gray-600">Choose a document type and template to get started</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document Type Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Document Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Document Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter document title..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief description of the document..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Document Type *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {DOCUMENT_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.value}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            formData.type === type.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleInputChange('type', type.value)}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`h-5 w-5 mt-0.5 ${
                              formData.type === type.value ? 'text-blue-600' : 'text-gray-500'
                            }`} />
                            <div>
                              <div className="font-medium text-sm">{type.label}</div>
                              <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {availableTemplates.length > 0 && (
                  <div>
                    <Label>Template</Label>
                    <Select value={formData.template} onValueChange={(value) => handleInputChange('template', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTemplates.map((template) => (
                          <SelectItem key={template.name} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Option */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Or Upload Existing File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Upload PDF files or images to create a document
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Supported: PDF, JPG, PNG, GIF (Max 10MB)
                  </p>
                </div>
                {uploadProgress > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview/Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDocType && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <selectedDocType.icon className="h-8 w-8 text-blue-600" />
                      <div>
                        <div className="font-medium">{selectedDocType.label}</div>
                        <div className="text-sm text-gray-500">{selectedDocType.description}</div>
                      </div>
                    </div>
                    
                    {formData.title && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700">Title:</div>
                        <div className="text-sm text-gray-900">{formData.title}</div>
                      </div>
                    )}
                    
                    {formData.description && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700">Description:</div>
                        <div className="text-sm text-gray-900">{formData.description}</div>
                      </div>
                    )}
                    
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700">Template:</div>
                      <Badge variant="secondary" className="text-xs">
                        {formData.template}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Created by: {user?.name || user?.email}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Button 
                    onClick={handleCreateDocument}
                    disabled={!formData.title.trim() || isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Document
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/documents')}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}