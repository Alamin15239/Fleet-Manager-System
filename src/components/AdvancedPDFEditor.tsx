'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, FileText, Layout, Settings, Save, Download, Edit
} from 'lucide-react';


interface PDFEditorProps {
  initialData?: {
    header?: string;
    content?: string;
    footer?: string;
  };
  onChange?: (data: any) => void;
}

export default function AdvancedPDFEditor({ initialData, onChange }: PDFEditorProps) {
  const [header, setHeader] = useState(initialData?.header || '');
  const [content, setContent] = useState(initialData?.content || '<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><p></p></div>');
  const [footer, setFooter] = useState(initialData?.footer || '');
  const [showPreview, setShowPreview] = useState(false);
  const [pageSettings, setPageSettings] = useState({
    orientation: 'portrait',
    margin: '20',
    pageSize: 'A4'
  });

  useEffect(() => {
    if (initialData?.content && initialData.content !== content) {
      setContent(initialData.content);
    }
  }, [initialData]);

  useEffect(() => {
    onChange?.({ header, content, footer, pageSettings });
  }, [header, content, footer, pageSettings, onChange]);

  const insertTemplate = (templateType: string) => {
    const templates = {
      business: `<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><h1 style="font-size: 18pt; font-weight: bold; color: #2F5496; margin-bottom: 12pt;">Business Report</h1><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; margin-bottom: 8pt;">Executive Summary</h2><p style="margin-bottom: 12pt;">This section provides an overview of the key findings and recommendations.</p><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; margin-bottom: 8pt;">Analysis</h2><p style="margin-bottom: 12pt;">Detailed analysis and data interpretation goes here.</p><h2 style="font-size: 14pt; font-weight: bold; color: #2F5496; margin-bottom: 8pt;">Recommendations</h2><ul style="margin-bottom: 12pt;"><li>Recommendation 1</li><li>Recommendation 2</li><li>Recommendation 3</li></ul></div>`,
      invoice: `<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><div style="text-align: center; margin-bottom: 30px;"><h1 style="font-size: 24pt; font-weight: bold; color: #2F5496;">INVOICE</h1><p>Invoice #: INV-${Date.now().toString().slice(-6)}</p><p>Date: ${new Date().toLocaleDateString()}</p></div><div style="margin-bottom: 20px;"><strong>Bill To:</strong><br>Customer Name<br>Address Line 1<br>City, State ZIP</div><table style="width: 100%; border-collapse: collapse; border: 1px solid #333;"><tr style="background-color: #2F5496; color: white;"><th style="border: 1px solid #333; padding: 8px;">Description</th><th style="border: 1px solid #333; padding: 8px;">Quantity</th><th style="border: 1px solid #333; padding: 8px;">Rate</th><th style="border: 1px solid #333; padding: 8px;">Amount</th></tr><tr><td style="border: 1px solid #333; padding: 8px;">Service/Product</td><td style="border: 1px solid #333; padding: 8px; text-align: center;">1</td><td style="border: 1px solid #333; padding: 8px; text-align: right;">$100.00</td><td style="border: 1px solid #333; padding: 8px; text-align: right;">$100.00</td></tr></table></div>`,
      letter: `<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 1in;"><div style="margin-bottom: 40px;"><p>${new Date().toLocaleDateString()}</p></div><div style="margin-bottom: 30px;"><p>Dear [Recipient Name],</p></div><div style="margin-bottom: 30px;"><p>I am writing to [state your purpose]. Please find the details below.</p><p>[Continue with your message content here.]</p></div><div><p>Sincerely,</p><br><p>[Your Name]</p></div></div>`
    };
    
    if (templates[templateType as keyof typeof templates]) {
      setContent(templates[templateType as keyof typeof templates]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Document Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => insertTemplate('business')}>
              Business Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => insertTemplate('invoice')}>
              Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={() => insertTemplate('letter')}>
              Letter
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>PDF Content Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header */}
              <div>
                <Label>Document Header</Label>
                <Input
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  placeholder="Enter header text..."
                  className="mt-1"
                />
              </div>

              {/* Main Editor */}
              <div>
                <Label>Content</Label>
                <div className="mt-1">
                  <div className="border rounded-lg">
                    {/* MS Word-like Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50/50">
                      <select className="px-2 py-1 border rounded text-sm" onChange={(e) => document.execCommand('fontName', false, e.target.value)}>
                        <option value="Calibri">Calibri</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                      </select>
                      <select className="px-2 py-1 border rounded text-sm" onChange={(e) => document.execCommand('fontSize', false, e.target.value)}>
                        <option value="3">12pt</option>
                        <option value="4">14pt</option>
                        <option value="5">16pt</option>
                        <option value="6">18pt</option>
                      </select>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('bold')}><strong>B</strong></button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('italic')}><em>I</em></button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('underline')}><u>U</u></button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('justifyLeft')}>⬅</button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('justifyCenter')}>⬌</button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('justifyRight')}>➡</button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('insertUnorderedList')}>• List</button>
                      <button className="px-2 py-1 border rounded hover:bg-gray-100" onClick={() => document.execCommand('insertOrderedList')}>1. List</button>
                      <input type="color" className="w-8 h-8 border rounded" onChange={(e) => document.execCommand('foreColor', false, e.target.value)} title="Text Color" />
                    </div>
                    <div
                      contentEditable
                      className="min-h-[400px] p-4 focus:outline-none"
                      style={{ fontFamily: 'Calibri, sans-serif', fontSize: '11pt', lineHeight: '1.15' }}
                      onInput={(e) => setContent((e.target as HTMLDivElement).innerHTML)}
                      dangerouslySetInnerHTML={{ __html: content }}
                      suppressContentEditableWarning={true}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div>
                <Label>Document Footer</Label>
                <Input
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  placeholder="Enter footer text (use {page} for page numbers)..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings & Preview */}
        <div className="space-y-6">
          {/* Page Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Page Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Page Size</Label>
                <Select value={pageSettings.pageSize} onValueChange={(value) => 
                  setPageSettings(prev => ({ ...prev, pageSize: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A3">A3</SelectItem>
                    <SelectItem value="Letter">Letter</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Orientation</Label>
                <Select value={pageSettings.orientation} onValueChange={(value) => 
                  setPageSettings(prev => ({ ...prev, orientation: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Margins (px)</Label>
                <Input
                  value={pageSettings.margin}
                  onChange={(e) => setPageSettings(prev => ({ ...prev, margin: e.target.value }))}
                  placeholder="20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-white shadow-sm max-h-96 overflow-auto">
                  {header && (
                    <div className="text-center border-b pb-2 mb-4">
                      <h1 className="text-lg font-bold">{header}</h1>
                    </div>
                  )}
                  <div 
                    className="prose max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: content || '<p>Start typing to see preview...</p>' }}
                  />
                  {footer && (
                    <div className="text-center border-t pt-2 mt-4">
                      <p className="text-xs text-gray-600">{footer.replace('{page}', '1')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>


    </div>
  );
}