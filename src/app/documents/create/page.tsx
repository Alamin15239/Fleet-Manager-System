'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Save, Upload, ArrowLeft, Plus, 
  FileImage, Loader2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

const PDF_TEMPLATES = [
  { 
    name: 'Blank PDF', 
    data: { 
      header: '', 
      content: '<p>Start writing your document content here...</p>', 
      footer: '' 
    } 
  },
  { 
    name: 'Business Letter', 
    data: { 
      header: 'Company Letterhead', 
      content: '<p><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</p><br><p><strong>Dear [Recipient],</strong></p><br><p>Your message content goes here...</p><br><p>Sincerely,</p><p>[Your Name]</p>', 
      footer: 'Page {page}' 
    } 
  },
  { 
    name: 'Report Template', 
    data: { 
      header: 'REPORT TITLE', 
      content: '<h2>Executive Summary</h2><p>Brief overview of the report...</p><br><h2>Introduction</h2><p>Background information...</p><br><h2>Findings</h2><p>Key findings and analysis...</p><br><h2>Recommendations</h2><p>Recommended actions...</p><br><h2>Conclusion</h2><p>Summary and final thoughts...</p>', 
      footer: 'Confidential - Page {page}' 
    } 
  },
  { 
    name: 'Invoice Template', 
    data: { 
      header: 'INVOICE', 
      content: '<div style="display: flex; justify-content: space-between;"><div><strong>Invoice #:</strong> INV-001<br><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</div><div><strong>Due Date:</strong> ' + new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString() + '</div></div><br><div><strong>Bill To:</strong><br>Customer Name<br>Customer Address</div><br><table style="width: 100%; border-collapse: collapse;"><tr style="background: #f5f5f5;"><th style="border: 1px solid #ddd; padding: 8px;">Description</th><th style="border: 1px solid #ddd; padding: 8px;">Quantity</th><th style="border: 1px solid #ddd; padding: 8px;">Rate</th><th style="border: 1px solid #ddd; padding: 8px;">Amount</th></tr><tr><td style="border: 1px solid #ddd; padding: 8px;">Service/Product</td><td style="border: 1px solid #ddd; padding: 8px;">1</td><td style="border: 1px solid #ddd; padding: 8px;">$100.00</td><td style="border: 1px solid #ddd; padding: 8px;">$100.00</td></tr></table><br><div style="text-align: right;"><strong>Total: $100.00</strong></div>', 
      footer: 'Thank you for your business!' 
    } 
  }
];

export default function CreateDocumentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    template: 'Blank PDF'
  });
  const [isLoading, setIsLoading] = useState(false);

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
      
      // Get template data
      const selectedTemplate = PDF_TEMPLATES.find(t => t.name === formData.template);
      const editorState = selectedTemplate?.data || { header: '', content: '', footer: '' };

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          type: 'pdf',
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
        toast.error(error.error || 'Failed to create document');
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
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);

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
            type: 'pdf',
            fileUrl: uploadResult.url,
            description: 'Uploaded PDF file'
          })
        });

        if (docResponse.ok) {
          const document = await docResponse.json();
          toast.success('PDF uploaded successfully');
          router.push(`/documents/${document.id}`);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New PDF Document</h1>
            <p className="text-gray-600">Create a new PDF document or upload an existing one</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document Creation Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New PDF
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
                  <Label>Choose Template</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {PDF_TEMPLATES.map((template) => (
                      <div
                        key={template.name}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          formData.template === template.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleInputChange('template', template.name)}
                      >
                        <div className="flex items-start gap-3">
                          <FileText className={`h-5 w-5 mt-0.5 ${
                            formData.template === template.name ? 'text-blue-600' : 'text-gray-500'
                          }`} />
                          <div>
                            <div className="font-medium text-sm">{template.name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
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
                        Create PDF Document
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upload Option */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Existing PDF
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Upload an existing PDF file to add to your document library
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose PDF File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Supported: PDF files only (Max 10MB)
                  </p>
                </div>
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
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="h-8 w-8 text-red-600" />
                    <div>
                      <div className="font-medium">PDF Document</div>
                      <div className="text-sm text-gray-500">Professional PDF format</div>
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

                <div className="space-y-2">
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