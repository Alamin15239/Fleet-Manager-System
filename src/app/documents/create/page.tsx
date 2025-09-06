'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, ArrowLeft, Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

const PDF_TEMPLATES = [
  { 
    name: 'Blank document', 
    description: 'Create a new empty document',
    preview: '/api/placeholder/200/260',
    category: 'General',
    data: { 
      header: '', 
      content: '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><p></p></div>', 
      footer: '' 
    } 
  },
  { 
    name: 'Business letter', 
    description: 'Professional business correspondence',
    preview: '/api/placeholder/200/260',
    category: 'Business',
    data: { 
      header: '', 
      content: '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><p style="text-align: right; margin-bottom: 24pt;">[Your Name]<br>[Your Address]<br>[City, State ZIP Code]<br>[Email Address]<br>[Phone Number]</p><p style="margin-bottom: 12pt;">' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p><p style="margin-bottom: 24pt;">[Recipient Name]<br>[Title]<br>[Company Name]<br>[Address]<br>[City, State ZIP Code]</p><p style="margin-bottom: 12pt;">Dear [Recipient Name],</p><p style="margin-bottom: 12pt;">I am writing to [state your purpose]. [Continue with your message content here.]</p><p style="margin-bottom: 12pt;">[Second paragraph with additional details or supporting information.]</p><p style="margin-bottom: 12pt;">Thank you for your time and consideration. I look forward to hearing from you.</p><p style="margin-bottom: 24pt;">Sincerely,</p><p>[Your Name]</p></div>', 
      footer: '' 
    } 
  },
  { 
    name: 'Resume', 
    description: 'Professional resume template',
    preview: '/api/placeholder/200/260',
    category: 'Personal',
    data: { 
      header: '', 
      content: '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><h1 style="font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 6pt; color: #2F5496;">[Your Full Name]</h1><p style="text-align: center; margin-bottom: 18pt; font-size: 10pt;">[Your Address] | [Phone] | [Email] | [LinkedIn Profile]</p><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; border-bottom: 1pt solid #2F5496; margin-bottom: 6pt;">PROFESSIONAL SUMMARY</h2><p style="margin-bottom: 18pt;">[Brief professional summary highlighting your key qualifications and career objectives.]</p><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; border-bottom: 1pt solid #2F5496; margin-bottom: 6pt;">EXPERIENCE</h2><p style="margin-bottom: 6pt;"><strong>[Job Title] | [Company Name]</strong> <span style="float: right;">[Start Date] - [End Date]</span></p><ul style="margin-bottom: 12pt;"><li>[Key achievement or responsibility]</li><li>[Key achievement or responsibility]</li><li>[Key achievement or responsibility]</li></ul><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; border-bottom: 1pt solid #2F5496; margin-bottom: 6pt;">EDUCATION</h2><p style="margin-bottom: 6pt;"><strong>[Degree] | [University Name]</strong> <span style="float: right;">[Graduation Year]</span></p><p style="margin-bottom: 18pt;">[Additional education details if relevant]</p><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; border-bottom: 1pt solid #2F5496; margin-bottom: 6pt;">SKILLS</h2><p>[List of relevant skills separated by commas]</p></div>', 
      footer: '' 
    } 
  },
  { 
    name: 'Report', 
    description: 'Formal business report format',
    preview: '/api/placeholder/200/260',
    category: 'Business',
    data: { 
      header: '', 
      content: '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><h1 style="font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 24pt; color: #1F4E79;">[REPORT TITLE]</h1><p style="text-align: center; margin-bottom: 36pt; font-size: 10pt;">Prepared by: [Your Name]<br>Date: ' + new Date().toLocaleDateString() + '</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Executive Summary</h2><p style="margin-bottom: 18pt;">[Provide a brief overview of the report\'s key findings and recommendations.]</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Introduction</h2><p style="margin-bottom: 18pt;">[Explain the purpose and scope of this report.]</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Methodology</h2><p style="margin-bottom: 18pt;">[Describe the methods used to gather and analyze information.]</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Findings</h2><p style="margin-bottom: 18pt;">[Present your key findings and analysis.]</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Recommendations</h2><p style="margin-bottom: 18pt;">[Provide specific recommendations based on your findings.]</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Conclusion</h2><p>[Summarize the main points and next steps.]</p></div>', 
      footer: '<div style="text-align: center; font-size: 9pt; color: #666;">Page {page}</div>' 
    } 
  },
  { 
    name: 'Invoice', 
    description: 'Professional invoice template',
    preview: '/api/placeholder/200/260',
    category: 'Business',
    data: { 
      header: '', 
      content: '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><table style="width: 100%; margin-bottom: 24pt;"><tr><td style="width: 50%;"><h1 style="font-size: 24pt; font-weight: bold; color: #2F5496; margin: 0;">INVOICE</h1></td><td style="width: 50%; text-align: right; vertical-align: top;"><strong>[Your Company Name]</strong><br>[Address]<br>[City, State ZIP]<br>[Phone] | [Email]</td></tr></table><table style="width: 100%; margin-bottom: 24pt;"><tr><td style="width: 50%; vertical-align: top;"><strong>Bill To:</strong><br>[Client Name]<br>[Client Address]<br>[City, State ZIP]</td><td style="width: 50%; text-align: right; vertical-align: top;"><strong>Invoice #:</strong> INV-' + Date.now().toString().slice(-6) + '<br><strong>Date:</strong> ' + new Date().toLocaleDateString() + '<br><strong>Due Date:</strong> ' + new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString() + '</td></tr></table><table style="width: 100%; border-collapse: collapse; margin-bottom: 24pt;"><tr style="background-color: #2F5496; color: white;"><th style="border: 1pt solid #2F5496; padding: 8pt; text-align: left;">Description</th><th style="border: 1pt solid #2F5496; padding: 8pt; text-align: center;">Qty</th><th style="border: 1pt solid #2F5496; padding: 8pt; text-align: right;">Rate</th><th style="border: 1pt solid #2F5496; padding: 8pt; text-align: right;">Amount</th></tr><tr><td style="border: 1pt solid #ccc; padding: 8pt;">Professional Services</td><td style="border: 1pt solid #ccc; padding: 8pt; text-align: center;">1</td><td style="border: 1pt solid #ccc; padding: 8pt; text-align: right;">$500.00</td><td style="border: 1pt solid #ccc; padding: 8pt; text-align: right;">$500.00</td></tr><tr><td style="border: 1pt solid #ccc; padding: 8pt;">Additional Services</td><td style="border: 1pt solid #ccc; padding: 8pt; text-align: center;">2</td><td style="border: 1pt solid #ccc; padding: 8pt; text-align: right;">$150.00</td><td style="border: 1pt solid #ccc; padding: 8pt; text-align: right;">$300.00</td></tr></table><table style="width: 100%;"><tr><td style="width: 70%;"></td><td style="width: 30%;"><table style="width: 100%;"><tr><td><strong>Subtotal:</strong></td><td style="text-align: right;">$800.00</td></tr><tr><td><strong>Tax (10%):</strong></td><td style="text-align: right;">$80.00</td></tr><tr style="border-top: 2pt solid #2F5496;"><td><strong>Total:</strong></td><td style="text-align: right;"><strong>$880.00</strong></td></tr></table></td></tr></table></div>', 
      footer: '<div style="text-align: center; font-size: 9pt; color: #666;">Thank you for your business!</div>' 
    } 
  },
  { 
    name: 'Meeting notes', 
    description: 'Structured meeting documentation',
    preview: '/api/placeholder/200/260',
    category: 'Business',
    data: { 
      header: '', 
      content: '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><h1 style="font-size: 16pt; font-weight: bold; color: #1F4E79; margin-bottom: 24pt;">Meeting Notes</h1><table style="width: 100%; margin-bottom: 24pt; border-collapse: collapse;"><tr><td style="width: 20%; font-weight: bold; padding: 4pt; border-bottom: 1pt solid #ccc;">Date:</td><td style="padding: 4pt; border-bottom: 1pt solid #ccc;">' + new Date().toLocaleDateString() + '</td></tr><tr><td style="font-weight: bold; padding: 4pt; border-bottom: 1pt solid #ccc;">Time:</td><td style="padding: 4pt; border-bottom: 1pt solid #ccc;">[Start Time] - [End Time]</td></tr><tr><td style="font-weight: bold; padding: 4pt; border-bottom: 1pt solid #ccc;">Location:</td><td style="padding: 4pt; border-bottom: 1pt solid #ccc;">[Meeting Location]</td></tr><tr><td style="font-weight: bold; padding: 4pt; border-bottom: 1pt solid #ccc;">Attendees:</td><td style="padding: 4pt; border-bottom: 1pt solid #ccc;">[List of attendees]</td></tr></table><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Agenda</h2><ol style="margin-bottom: 18pt;"><li>[Agenda item 1]</li><li>[Agenda item 2]</li><li>[Agenda item 3]</li></ol><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Discussion Points</h2><p style="margin-bottom: 12pt;"><strong>[Topic 1]:</strong> [Discussion summary and key points]</p><p style="margin-bottom: 12pt;"><strong>[Topic 2]:</strong> [Discussion summary and key points]</p><p style="margin-bottom: 18pt;"><strong>[Topic 3]:</strong> [Discussion summary and key points]</p><h2 style="font-size: 14pt; font-weight: bold; color: #1F4E79; margin-bottom: 12pt;">Action Items</h2><table style="width: 100%; border-collapse: collapse;"><tr style="background-color: #E7E6E6;"><th style="border: 1pt solid #ccc; padding: 8pt; text-align: left;">Action</th><th style="border: 1pt solid #ccc; padding: 8pt; text-align: left;">Assigned To</th><th style="border: 1pt solid #ccc; padding: 8pt; text-align: left;">Due Date</th></tr><tr><td style="border: 1pt solid #ccc; padding: 8pt;">[Action item 1]</td><td style="border: 1pt solid #ccc; padding: 8pt;">[Person]</td><td style="border: 1pt solid #ccc; padding: 8pt;">[Date]</td></tr><tr><td style="border: 1pt solid #ccc; padding: 8pt;">[Action item 2]</td><td style="border: 1pt solid #ccc; padding: 8pt;">[Person]</td><td style="border: 1pt solid #ccc; padding: 8pt;">[Date]</td></tr></table></div>', 
      footer: '<div style="text-align: center; font-size: 9pt; color: #666;">Page {page}</div>' 
    } 
  }
];

export default function CreateDocumentPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    template: 'Blank document'
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



  const selectedTemplate = PDF_TEMPLATES.find(t => t.name === formData.template);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">New</h1>
              <p className="text-sm text-gray-600">Choose a template to get started</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Quick Create Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Create New Document</CardTitle>
              <p className="text-gray-600">Start with a template or create a blank document</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-sm font-medium">Document Name</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Enter document name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-sm font-medium">Description (optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Brief description"
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Template</Label>
                    <Select value={formData.template} onValueChange={(value) => handleInputChange('template', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PDF_TEMPLATES.map((template) => (
                          <SelectItem key={template.name} value={template.name}>
                            {template.name} - {template.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTemplate && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="font-medium text-sm text-blue-900">{selectedTemplate.name}</div>
                      <div className="text-xs text-blue-700 mt-1">{selectedTemplate.description}</div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleCreateDocument}
                  disabled={!formData.title.trim() || isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Document'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/documents')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}