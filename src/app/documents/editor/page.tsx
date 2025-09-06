'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MicrosoftWordEditor from '@/components/MicrosoftWordEditor';
import { useToast } from '@/hooks/use-toast';

export default function DocumentEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [document, setDocument] = useState({
    id: '',
    title: 'New Document',
    content: '',
    type: 'text'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const documentId = searchParams.get('id');
    const documentType = searchParams.get('type');
    
    if (documentId) {
      fetchDocument(documentId);
    } else if (documentType) {
      createNewDocument(documentType);
    } else {
      createNewDocument('text');
    }
  }, [searchParams]);

  const fetchDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`);
      if (response.ok) {
        const doc = await response.json();
        setDocument(doc);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewDocument = async (type: string) => {
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
        const newDoc = await response.json();
        setDocument(newDoc);
        router.replace(`/documents/editor?id=${newDoc.id}`);
      }
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async () => {
    if (!document.id) return;
    
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.title,
          content: document.content,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Document saved successfully',
        });
      }
    } catch (error) {
      console.error('Error saving document:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <MicrosoftWordEditor
        value={document.content}
        title={document.title}
        onChange={(content) => setDocument({ ...document, content })}
        onTitleChange={(title) => setDocument({ ...document, title })}
        onSave={saveDocument}
      />
    </div>
  );
}