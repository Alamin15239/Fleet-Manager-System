'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import MicrosoftWordEditor from '@/components/MicrosoftWordEditor';
import { 
  Save, ArrowLeft, Eye, Clock, User, 
  FileText, Loader2, AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

export default function EditDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [document, setDocument] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editorContent, setEditorContent] = useState({ header: '', content: '', footer: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDocument();
    }
  }, [params.id]);

  useEffect(() => {
    // Auto-save every 30 seconds if there are unsaved changes
    const interval = setInterval(() => {
      if (hasUnsavedChanges && !isSaving) {
        handleSave(true); // Silent save
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, isSaving]);

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
        setTitle(data.title);
        setDescription(data.description || '');
        setEditorContent(data.editorState || { header: '', content: '', footer: '' });
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

  const handleSave = async (silent = false) => {
    if (!title.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          editorState: editorContent
        })
      });

      if (response.ok) {
        const updatedDoc = await response.json();
        setDocument(updatedDoc);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        
        if (!silent) {
          toast.success('Document saved successfully');
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save document');
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (content: any) => {
    setEditorContent(content);
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    setHasUnsavedChanges(true);
  };

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
          <p className="text-gray-600 mb-4">The document you're trying to edit doesn't exist.</p>
          <Button onClick={() => router.push('/documents')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  // Check if document has uploaded file (can't edit)
  if (document.fileUrl) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cannot Edit Uploaded PDF</h2>
          <p className="text-gray-600 mb-4">This document was uploaded as a PDF file and cannot be edited.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push(`/documents/${params.id}`)} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              View Document
            </Button>
            <Button onClick={() => router.push('/documents')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Documents
            </Button>
          </div>
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
              <h1 className="text-2xl font-bold text-gray-900">Edit PDF Document</h1>
              <div className="flex items-center gap-4 mt-1">
                <Badge variant="secondary">PDF</Badge>
                <span className="text-sm text-gray-500">Version {document.version}</span>
                {lastSaved && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Saved {lastSaved.toLocaleTimeString()}
                  </div>
                )}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1 text-sm text-amber-600">
                    <Clock className="h-3 w-3" />
                    Unsaved changes
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/documents/${params.id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              onClick={() => handleSave(false)}
              disabled={isSaving || !hasUnsavedChanges}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="border-b">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Document Title
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Enter document title..."
                      className="text-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Description (Optional)
                    </label>
                    <Textarea
                      value={description}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      placeholder="Brief description of the document..."
                      rows={2}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[800px]">
                  <MicrosoftWordEditor 
                    value={editorContent.content}
                    onChange={(content) => handleContentChange({ ...editorContent, content })}
                    title={title}
                    onTitleChange={handleTitleChange}
                    onSave={() => handleSave(false)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
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
                      <div className="text-sm font-medium text-gray-900 mt-1">PDF Document</div>
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
                        <div className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                          <User className="h-3 w-3" />
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
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleSave(false)}
                    disabled={isSaving || !hasUnsavedChanges}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Document
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => router.push(`/documents/${params.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Document
                  </Button>
                  
                  <Separator />
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => router.push('/documents')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Documents
                  </Button>
                </CardContent>
              </Card>

              {/* Auto-save Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Auto-save</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-500' : 'bg-green-500'}`} />
                      {hasUnsavedChanges ? 'Changes pending' : 'All changes saved'}
                    </div>
                    <p className="text-xs text-gray-500">
                      Documents are automatically saved every 30 seconds
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}