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
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Image, Link, Table, Eye, FileText,
  Palette, Type, Layout, Settings, Save, Download, Edit
} from 'lucide-react';
import ImageEditor from './ImageEditor';

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
  const [content, setContent] = useState(initialData?.content || '');
  const [footer, setFooter] = useState(initialData?.footer || '');
  const [template, setTemplate] = useState('blank');
  const [fontSize, setFontSize] = useState('12');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [showPreview, setShowPreview] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [pageSettings, setPageSettings] = useState({
    orientation: 'portrait',
    margin: '20',
    pageSize: 'A4'
  });

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChange?.({ header, content, footer, pageSettings });
  }, [header, content, footer, pageSettings, onChange]);

  const execCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      setContent(editorRef.current.innerHTML);
    }
  };

  const insertTemplate = (templateType: string) => {
    const templates = {
      business: `
        <h1>Business Report</h1>
        <h2>Executive Summary</h2>
        <p>This section provides an overview of the key findings and recommendations.</p>
        <h2>Analysis</h2>
        <p>Detailed analysis and data interpretation goes here.</p>
        <h2>Recommendations</h2>
        <ul>
          <li>Recommendation 1</li>
          <li>Recommendation 2</li>
          <li>Recommendation 3</li>
        </ul>
      `,
      invoice: `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1>INVOICE</h1>
          <p>Invoice #: INV-001</p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
        <div style="margin-bottom: 20px;">
          <strong>Bill To:</strong><br>
          Customer Name<br>
          Address Line 1<br>
          City, State ZIP
        </div>
        <table border="1" style="width: 100%; border-collapse: collapse;">
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
          <tr>
            <td>Service/Product</td>
            <td>1</td>
            <td>$100.00</td>
            <td>$100.00</td>
          </tr>
        </table>
      `,
      letter: `
        <div style="margin-bottom: 40px;">
          <p>${new Date().toLocaleDateString()}</p>
        </div>
        <div style="margin-bottom: 30px;">
          <p>Dear [Recipient Name],</p>
        </div>
        <div style="margin-bottom: 30px;">
          <p>I am writing to...</p>
          <p>Please find attached...</p>
        </div>
        <div>
          <p>Sincerely,</p>
          <br>
          <p>[Your Name]</p>
        </div>
      `
    };
    
    if (editorRef.current && templates[templateType as keyof typeof templates]) {
      editorRef.current.innerHTML = templates[templateType as keyof typeof templates];
      setContent(editorRef.current.innerHTML);
    }
  };

  const insertTable = () => {
    const tableHTML = `
      <table border="1" style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr>
          <th style="padding: 8px; background-color: #f5f5f5;">Header 1</th>
          <th style="padding: 8px; background-color: #f5f5f5;">Header 2</th>
          <th style="padding: 8px; background-color: #f5f5f5;">Header 3</th>
        </tr>
        <tr>
          <td style="padding: 8px;">Cell 1</td>
          <td style="padding: 8px;">Cell 2</td>
          <td style="padding: 8px;">Cell 3</td>
        </tr>
      </table>
    `;
    execCommand('insertHTML', tableHTML);
  };

  const insertImage = () => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          setCurrentImageUrl(imageUrl);
          setShowImageEditor(true);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleImageSave = (editedImageUrl: string) => {
    const img = `<img src="${editedImageUrl}" alt="Inserted image" style="max-width: 100%; height: auto; margin: 10px 0; border: 2px solid transparent; border-radius: 4px;" class="editable-image" />`;
    execCommand('insertHTML', img);
    setShowImageEditor(false);
    setCurrentImageUrl('');
  };

  const handleImageCancel = () => {
    setShowImageEditor(false);
    setCurrentImageUrl('');
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
                <div className="border rounded-lg mt-1">
                  {/* Toolbar */}
                  <div className="flex flex-wrap gap-1 p-3 border-b bg-gray-50">
                    <Select value={fontFamily} onValueChange={(value) => {
                      setFontFamily(value);
                      execCommand('fontName', value);
                    }}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={fontSize} onValueChange={(value) => {
                      setFontSize(value);
                      execCommand('fontSize', value);
                    }}>
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">8</SelectItem>
                        <SelectItem value="2">10</SelectItem>
                        <SelectItem value="3">12</SelectItem>
                        <SelectItem value="4">14</SelectItem>
                        <SelectItem value="5">16</SelectItem>
                        <SelectItem value="6">18</SelectItem>
                        <SelectItem value="7">24</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex gap-1 border-l pl-2">
                      <Button variant="outline" size="sm" onClick={() => execCommand('bold')}>
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => execCommand('italic')}>
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => execCommand('underline')}>
                        <Underline className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-1 border-l pl-2">
                      <Button variant="outline" size="sm" onClick={() => execCommand('justifyLeft')}>
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => execCommand('justifyCenter')}>
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => execCommand('justifyRight')}>
                        <AlignRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-1 border-l pl-2">
                      <Button variant="outline" size="sm" onClick={() => execCommand('insertUnorderedList')}>
                        <List className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => execCommand('insertOrderedList')}>
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-1 border-l pl-2">
                      <Button variant="outline" size="sm" onClick={insertTable}>
                        <Table className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={insertImage}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image className="h-4 w-4" />
                      </Button>
                    </div>

                    <input 
                      type="color" 
                      className="w-8 h-8 border rounded cursor-pointer"
                      onChange={(e) => execCommand('foreColor', e.target.value)}
                      title="Text Color"
                    />
                  </div>

                  {/* Editor Area */}
                  <div
                    ref={editorRef}
                    contentEditable
                    className="min-h-64 p-4 focus:outline-none"
                    onInput={() => setContent(editorRef.current?.innerHTML || '')}
                    dangerouslySetInnerHTML={{ __html: content }}
                    suppressContentEditableWarning={true}
                  />
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

      {/* Image Editor Modal */}
      {showImageEditor && currentImageUrl && (
        <ImageEditor
          imageUrl={currentImageUrl}
          onSave={handleImageSave}
          onCancel={handleImageCancel}
        />
      )}
    </div>
  );
}