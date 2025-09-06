'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, Link, Image, Table, Quote, Code, 
  Undo, Redo, Palette, Type, Subscript, Superscript, Highlighter, Copy, Scissors as Cut, Clipboard as Paste,
  Save, FileText, Download, Printer as Print, Share, Search, Replace, Zoom, Eye, Settings,
  BookOpen, MessageSquare, Shield, Mic, Volume2, FileImage, Shapes, BarChart3,
  PlusCircle, Minus, MoreHorizontal, ChevronDown, Home, Layout, FileCheck,
  Mail, Database, Zap, Languages, Calculator, Calendar, Clock, Globe,
  Paintbrush, Layers, Grid, Hash, AtSign, DollarSign, Percent, Star,
  CheckSquare, Square, Circle, Triangle, Heart, Smile, MapPin, Phone
} from 'lucide-react';

interface WordEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  onSave?: () => void;
}

export default function MicrosoftWordEditor({ value = '', onChange, title = 'Document', onTitleChange, onSave }: WordEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState('11');
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [activeTab, setActiveTab] = useState('Home');
  const [zoom, setZoom] = useState(100);
  const [wordCount, setWordCount] = useState(0);
  const [isTrackChanges, setIsTrackChanges] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isSpellCheckEnabled, setIsSpellCheckEnabled] = useState(true);
  const [documentLanguage, setDocumentLanguage] = useState('en-US');
  const [autoSave, setAutoSave] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [showGridlines, setShowGridlines] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [macros, setMacros] = useState<{name: string, content: string}[]>([]);
  const [mailMergeData, setMailMergeData] = useState<any[]>([]);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
      updateWordCount();
    }
  }, [value]);

  const execCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      handleContentChange();
    }
  };

  const handleContentChange = () => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
      updateWordCount();
    }
  };

  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
    }
  };

  const insertTable = () => {
    const rows = prompt('Number of rows:', '3') || '3';
    const cols = prompt('Number of columns:', '3') || '3';
    
    let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #d1d5db;">';
    
    for (let i = 0; i < parseInt(rows); i++) {
      tableHTML += '<tr>';
      for (let j = 0; j < parseInt(cols); j++) {
        tableHTML += `<td style="border: 1px solid #d1d5db; padding: 8px; min-width: 100px;">${i === 0 ? `Header ${j + 1}` : `Cell ${i}-${j + 1}`}</td>`;
      }
      tableHTML += '</tr>';
    }
    
    tableHTML += '</table>';
    execCommand('insertHTML', tableHTML);
  };

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          const img = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;" />`;
          execCommand('insertHTML', img);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const insertChart = () => {
    const chartHTML = `
      <div style="border: 2px dashed #ccc; padding: 20px; margin: 10px 0; text-align: center; background: #f9f9f9;">
        <BarChart3 style="width: 48px; height: 48px; margin: 0 auto; color: #666;" />
        <p style="margin: 10px 0; color: #666;">Chart Placeholder - Click to edit</p>
      </div>
    `;
    execCommand('insertHTML', chartHTML);
  };

  const applyHeading = (level: string) => {
    const headingStyles = {
      'h1': 'font-size: 24pt; font-weight: bold; margin: 12pt 0; color: #2c3e50;',
      'h2': 'font-size: 18pt; font-weight: bold; margin: 10pt 0; color: #34495e;',
      'h3': 'font-size: 14pt; font-weight: bold; margin: 8pt 0; color: #34495e;',
      'h4': 'font-size: 12pt; font-weight: bold; margin: 6pt 0; color: #34495e;',
      'p': 'font-size: 11pt; margin: 6pt 0; line-height: 1.15;'
    };
    
    execCommand('formatBlock', `<${level}>`);
    
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const element = range.commonAncestorContainer.parentElement;
        if (element && element.tagName.toLowerCase() === level) {
          element.style.cssText = headingStyles[level as keyof typeof headingStyles];
        }
      }
    }, 10);
  };

  const insertFootnote = () => {
    const footnoteText = prompt('Enter footnote text:');
    if (footnoteText) {
      const footnoteHTML = `<sup style="color: blue; cursor: pointer;" title="${footnoteText}">[1]</sup>`;
      execCommand('insertHTML', footnoteHTML);
    }
  };

  const insertTOC = () => {
    const tocHTML = `
      <div style="border: 1px solid #ccc; padding: 15px; margin: 20px 0; background: #f9f9f9;">
        <h3 style="margin: 0 0 10px 0; color: #333;">Table of Contents</h3>
        <p style="margin: 5px 0; cursor: pointer; color: #0066cc;">1. Introduction ........................... 1</p>
        <p style="margin: 5px 0; cursor: pointer; color: #0066cc;">2. Main Content ........................ 2</p>
        <p style="margin: 5px 0; cursor: pointer; color: #0066cc;">3. Conclusion ............................ 3</p>
      </div>
    `;
    execCommand('insertHTML', tocHTML);
  };

  const insertPageBreak = () => {
    const pageBreakHTML = '<div style="page-break-before: always; border-top: 1px dashed #ccc; margin: 20px 0; padding-top: 20px;"></div>';
    execCommand('insertHTML', pageBreakHTML);
  };

  const findAndReplace = useCallback(() => {
    if (!findText || !editorRef.current) return;
    
    const content = editorRef.current.innerHTML;
    const regex = new RegExp(findText, 'gi');
    const newContent = content.replace(regex, replaceText || findText);
    editorRef.current.innerHTML = newContent;
    handleContentChange();
  }, [findText, replaceText]);

  const insertSymbol = (symbol: string) => {
    execCommand('insertHTML', symbol);
  };

  const insertDate = () => {
    const date = new Date().toLocaleDateString();
    execCommand('insertHTML', date);
  };

  const insertTime = () => {
    const time = new Date().toLocaleTimeString();
    execCommand('insertHTML', time);
  };

  const applyTextEffect = (effect: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      
      switch (effect) {
        case 'shadow':
          span.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
          break;
        case 'outline':
          span.style.webkitTextStroke = '1px black';
          span.style.webkitTextFillColor = 'transparent';
          break;
        case 'glow':
          span.style.textShadow = '0 0 10px #00ff00';
          break;
        case 'emboss':
          span.style.textShadow = '1px 1px 0px #ccc, 0px 0px 0px #000';
          break;
      }
      
      try {
        range.surroundContents(span);
      } catch (e) {
        span.innerHTML = range.toString();
        range.deleteContents();
        range.insertNode(span);
      }
    }
  };

  const insertSmartArt = () => {
    const smartArtHTML = `
      <div style="border: 2px solid #2196f3; padding: 20px; margin: 10px 0; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 8px; text-align: center;">
        <div style="display: flex; justify-content: space-around; align-items: center;">
          <div style="background: #2196f3; color: white; padding: 10px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-weight: bold;">1</div>
          <div style="border-top: 2px solid #2196f3; width: 50px;"></div>
          <div style="background: #2196f3; color: white; padding: 10px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-weight: bold;">2</div>
          <div style="border-top: 2px solid #2196f3; width: 50px;"></div>
          <div style="background: #2196f3; color: white; padding: 10px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-weight: bold;">3</div>
        </div>
        <p style="margin-top: 15px; color: #1976d2; font-weight: bold;">Process Flow Diagram</p>
      </div>
    `;
    execCommand('insertHTML', smartArtHTML);
  };

  const insertEquation = () => {
    const equation = prompt('Enter equation (e.g., x² + y² = z²):');
    if (equation) {
      const equationHTML = `<span style="font-family: 'Times New Roman', serif; font-style: italic; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd;">${equation}</span>`;
      execCommand('insertHTML', equationHTML);
    }
  };

  const runMacro = (macroContent: string) => {
    try {
      if (macroContent.includes('insertText:')) {
        const text = macroContent.split('insertText:')[1];
        execCommand('insertHTML', text);
      }
    } catch (error) {
      console.error('Macro execution error:', error);
    }
  };

  const exportToPDF = () => {
    if (editorRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { font-family: Calibri, sans-serif; margin: 1in; }
                @media print { body { margin: 0; } }
              </style>
            </head>
            <body>${editorRef.current.innerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const mailMerge = () => {
    if (mailMergeData.length === 0) {
      alert('No mail merge data available. Please add data first.');
      return;
    }
    
    const template = editorRef.current?.innerHTML || '';
    let mergedContent = '';
    
    mailMergeData.forEach((data, index) => {
      let personalizedContent = template;
      Object.keys(data).forEach(key => {
        const placeholder = `{{${key}}}`;
        personalizedContent = personalizedContent.replace(new RegExp(placeholder, 'g'), data[key]);
      });
      
      mergedContent += personalizedContent;
      if (index < mailMergeData.length - 1) {
        mergedContent += '<div style="page-break-before: always;"></div>';
      }
    });
    
    if (editorRef.current) {
      editorRef.current.innerHTML = mergedContent;
      handleContentChange();
    }
  };

  useEffect(() => {
    if (autoSave && onSave) {
      const interval = setInterval(() => {
        onSave();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [autoSave, onSave]);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-blue-600 text-white">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5" />
          <Input
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            className="bg-transparent border-none text-white placeholder-blue-200 focus:ring-0 font-medium"
            placeholder="Document title"
          />
          <span className="text-blue-200 text-sm">- Saved to Documents</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700" onClick={onSave}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
            <Share className="h-4 w-4 mr-1" />
            Share
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
            <MessageSquare className="h-4 w-4 mr-1" />
            Comments
          </Button>
        </div>
      </div>

      {/* Ribbon Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start bg-gray-50 rounded-none border-b">
          <TabsTrigger value="Home" className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            Home
          </TabsTrigger>
          <TabsTrigger value="Insert" className="flex items-center gap-1">
            <PlusCircle className="h-4 w-4" />
            Insert
          </TabsTrigger>
          <TabsTrigger value="Layout" className="flex items-center gap-1">
            <Layout className="h-4 w-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="References" className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            References
          </TabsTrigger>
          <TabsTrigger value="Review" className="flex items-center gap-1">
            <FileCheck className="h-4 w-4" />
            Review
          </TabsTrigger>
          <TabsTrigger value="Mailings" className="flex items-center gap-1">
            <Mail className="h-4 w-4" />
            Mailings
          </TabsTrigger>
          <TabsTrigger value="Developer" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Developer
          </TabsTrigger>
          <TabsTrigger value="View" className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            View
          </TabsTrigger>
        </TabsList>

        {/* Home Tab */}
        <TabsContent value="Home" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Clipboard */}
            <div className="flex flex-col items-center mr-4">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => execCommand('cut')}>
                  <Cut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('copy')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => execCommand('paste')} className="w-full">
                <Paste className="h-4 w-4 mr-1" />
                Paste
              </Button>
            </div>
            <Separator orientation="vertical" className="h-12 mr-4" />

            {/* Font */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <Select value={fontFamily} onValueChange={(value) => { setFontFamily(value); execCommand('fontName', value); }}>
                  <SelectTrigger className="w-32 h-6 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Calibri">Calibri</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Georgia">Georgia</SelectItem>
                    <SelectItem value="Verdana">Verdana</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fontSize} onValueChange={(value) => { setFontSize(value); execCommand('fontSize', value); }}>
                  <SelectTrigger className="w-12 h-6 text-xs">
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
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => execCommand('bold')}>
                  <Bold className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('italic')}>
                  <Italic className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('underline')}>
                  <Underline className="h-3 w-3" />
                </Button>
                <input type="color" className="w-6 h-6 border rounded" onChange={(e) => execCommand('foreColor', e.target.value)} />
              </div>
            </div>

            <Separator orientation="vertical" className="h-12 mx-2" />

            {/* Paragraph */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => execCommand('justifyLeft')}>
                  <AlignLeft className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('justifyCenter')}>
                  <AlignCenter className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('justifyRight')}>
                  <AlignRight className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('justifyFull')}>
                  <AlignJustify className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')}>
                  <List className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')}>
                  <ListOrdered className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('indent')}>
                  <Indent className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('outdent')}>
                  <Outdent className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator orientation="vertical" className="h-12 mx-2" />

            {/* Styles */}
            <div className="flex flex-col gap-1">
              <Select onValueChange={applyHeading}>
                <SelectTrigger className="w-24 h-6 text-xs">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p">Normal</SelectItem>
                  <SelectItem value="h1">Heading 1</SelectItem>
                  <SelectItem value="h2">Heading 2</SelectItem>
                  <SelectItem value="h3">Heading 3</SelectItem>
                  <SelectItem value="h4">Heading 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-12 mx-2" />

            {/* Text Effects */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => execCommand('superscript')}>
                  <Superscript className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('subscript')}>
                  <Subscript className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCommand('strikethrough')}>
                  <Strikethrough className="h-3 w-3" />
                </Button>
                <input type="color" className="w-6 h-6 border rounded" onChange={(e) => execCommand('hiliteColor', e.target.value)} title="Highlight" />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => applyTextEffect('shadow')} title="Text Shadow">
                  <Paintbrush className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => applyTextEffect('outline')} title="Text Outline">
                  <Circle className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => applyTextEffect('glow')} title="Text Glow">
                  <Star className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => applyTextEffect('emboss')} title="Emboss">
                  <Layers className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator orientation="vertical" className="h-12 mx-2" />

            {/* Quick Actions */}
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="sm" onClick={() => execCommand('undo')}>
                <Undo className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => execCommand('redo')}>
                <Redo className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Insert Tab */}
        <TabsContent value="Insert" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="sm" onClick={insertTable}>
              <Table className="h-4 w-4 mr-1" />
              Table
            </Button>
            <Button variant="ghost" size="sm" onClick={insertImage}>
              <Image className="h-4 w-4 mr-1" />
              Pictures
            </Button>
            <Button variant="ghost" size="sm" onClick={insertSmartArt}>
              <Layers className="h-4 w-4 mr-1" />
              SmartArt
            </Button>
            <Button variant="ghost" size="sm" onClick={insertChart}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Chart
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const url = prompt('Enter URL:');
              const text = prompt('Enter link text:');
              if (url && text) {
                execCommand('insertHTML', `<a href="${url}" style="color: #0066cc; text-decoration: underline;">${text}</a>`);
              }
            }}>
              <Link className="h-4 w-4 mr-1" />
              Link
            </Button>
            <Button variant="ghost" size="sm" onClick={insertPageBreak}>
              <FileText className="h-4 w-4 mr-1" />
              Page Break
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const shape = `<div style="width: 100px; height: 100px; background: #e3f2fd; border: 2px solid #2196f3; margin: 10px; display: inline-block; border-radius: 8px;"></div>`;
              execCommand('insertHTML', shape);
            }}>
              <Shapes className="h-4 w-4 mr-1" />
              Shapes
            </Button>
            <Button variant="ghost" size="sm" onClick={insertEquation}>
              <Calculator className="h-4 w-4 mr-1" />
              Equation
            </Button>
            <Button variant="ghost" size="sm" onClick={insertDate}>
              <Calendar className="h-4 w-4 mr-1" />
              Date
            </Button>
            <Button variant="ghost" size="sm" onClick={insertTime}>
              <Clock className="h-4 w-4 mr-1" />
              Time
            </Button>
          </div>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="Layout" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              if (editorRef.current) {
                editorRef.current.style.columnCount = '2';
                editorRef.current.style.columnGap = '20px';
              }
            }}>
              <Layout className="h-4 w-4 mr-1" />
              Columns
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const watermark = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72px; color: rgba(0,0,0,0.1); pointer-events: none; z-index: -1;">DRAFT</div>`;
              execCommand('insertHTML', watermark);
            }}>
              <Eye className="h-4 w-4 mr-1" />
              Watermark
            </Button>
            <Select onValueChange={(value) => {
              if (editorRef.current) {
                editorRef.current.style.margin = value;
              }
            }}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue placeholder="Margins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1in">Normal</SelectItem>
                <SelectItem value="0.5in">Narrow</SelectItem>
                <SelectItem value="1.5in">Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* References Tab */}
        <TabsContent value="References" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={insertTOC}>
              <BookOpen className="h-4 w-4 mr-1" />
              Table of Contents
            </Button>
            <Button variant="ghost" size="sm" onClick={insertFootnote}>
              <FileText className="h-4 w-4 mr-1" />
              Footnote
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const citation = prompt('Enter citation:');
              if (citation) {
                execCommand('insertHTML', `<span style="color: #666; font-style: italic;">(${citation})</span>`);
              }
            }}>
              <Quote className="h-4 w-4 mr-1" />
              Citation
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const bibliography = `<div style="margin: 20px 0; padding: 15px; border-left: 4px solid #2196f3; background: #f5f5f5;"><h4>Bibliography</h4><p>1. Author, A. (2024). Title of Work. Publisher.</p><p>2. Author, B. (2024). Another Title. Publisher.</p></div>`;
              execCommand('insertHTML', bibliography);
            }}>
              <BookOpen className="h-4 w-4 mr-1" />
              Bibliography
            </Button>
          </div>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="Review" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Button 
              variant={isTrackChanges ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setIsTrackChanges(!isTrackChanges)}
            >
              <FileCheck className="h-4 w-4 mr-1" />
              Track Changes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const comment = prompt('Add comment:');
              if (comment) {
                execCommand('insertHTML', `<span style="background: yellow; padding: 2px; border-radius: 2px;" title="${comment}">[Comment]</span>`);
              }
            }}>
              <MessageSquare className="h-4 w-4 mr-1" />
              New Comment
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              if (editorRef.current) {
                const text = editorRef.current.innerText;
                alert(`Spell check complete. ${text.split(' ').length} words checked.`);
              }
            }}>
              <FileCheck className="h-4 w-4 mr-1" />
              Spelling
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const utterance = new SpeechSynthesisUtterance(editorRef.current?.innerText || '');
              speechSynthesis.speak(utterance);
            }}>
              <Volume2 className="h-4 w-4 mr-1" />
              Read Aloud
            </Button>
            <Button variant="ghost" size="sm">
              <Shield className="h-4 w-4 mr-1" />
              Protect
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Search className="h-4 w-4 mr-1" />
                  Find & Replace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Find and Replace</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Find</Label>
                    <Input value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Enter text to find" />
                  </div>
                  <div>
                    <Label>Replace with</Label>
                    <Input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Enter replacement text" />
                  </div>
                  <Button onClick={findAndReplace}>Replace All</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        {/* Mailings Tab */}
        <TabsContent value="Mailings" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={mailMerge}>
              <Mail className="h-4 w-4 mr-1" />
              Start Mail Merge
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const name = prompt('Enter recipient name:');
              if (name) {
                execCommand('insertHTML', `<span style="background: #e3f2fd; padding: 2px 4px; border-radius: 2px;">{{${name}}}</span>`);
              }
            }}>
              <Database className="h-4 w-4 mr-1" />
              Insert Merge Field
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const sampleData = [
                { name: 'John Doe', email: 'john@example.com', company: 'ABC Corp' },
                { name: 'Jane Smith', email: 'jane@example.com', company: 'XYZ Inc' }
              ];
              setMailMergeData(sampleData);
              alert('Sample mail merge data loaded!');
            }}>
              <FileText className="h-4 w-4 mr-1" />
              Preview Results
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const envelope = `<div style="border: 2px solid #333; padding: 40px; margin: 20px 0; width: 400px; height: 200px; position: relative;"><div style="position: absolute; top: 20px; left: 20px;">From:<br/>{{SenderName}}<br/>{{SenderAddress}}</div><div style="position: absolute; bottom: 20px; right: 20px; text-align: right;">To:<br/>{{RecipientName}}<br/>{{RecipientAddress}}</div></div>`;
              execCommand('insertHTML', envelope);
            }}>
              <Mail className="h-4 w-4 mr-1" />
              Envelopes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const label = `<div style="border: 1px solid #333; padding: 10px; margin: 5px; width: 200px; height: 100px; display: inline-block;">{{RecipientName}}<br/>{{RecipientAddress}}</div>`;
              execCommand('insertHTML', label);
            }}>
              <FileText className="h-4 w-4 mr-1" />
              Labels
            </Button>
          </div>
        </TabsContent>

        {/* Developer Tab */}
        <TabsContent value="Developer" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Zap className="h-4 w-4 mr-1" />
                  Macros
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Macro Manager</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Macro Name</Label>
                    <Input placeholder="Enter macro name" />
                  </div>
                  <div>
                    <Label>Macro Content</Label>
                    <Textarea placeholder="insertText:Hello World!" className="h-32" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      const name = 'SampleMacro';
                      const content = 'insertText:This is a sample macro!';
                      setMacros([...macros, { name, content }]);
                    }}>Save Macro</Button>
                    <Button variant="outline" onClick={() => {
                      if (macros.length > 0) {
                        runMacro(macros[0].content);
                      }
                    }}>Run Macro</Button>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Saved Macros:</h4>
                    {macros.map((macro, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span>{macro.name}</span>
                        <Button size="sm" onClick={() => runMacro(macro.content)}>Run</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={() => {
              const checkbox = `<input type="checkbox" style="margin: 0 5px;"> <span>Checkbox</span>`;
              execCommand('insertHTML', checkbox);
            }}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Checkbox
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const dropdown = `<select style="padding: 4px; border: 1px solid #ccc; border-radius: 4px;"><option>Option 1</option><option>Option 2</option><option>Option 3</option></select>`;
              execCommand('insertHTML', dropdown);
            }}>
              <ChevronDown className="h-4 w-4 mr-1" />
              Dropdown
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const textInput = `<input type="text" placeholder="Enter text..." style="padding: 4px; border: 1px solid #ccc; border-radius: 4px; margin: 0 5px;" />`;
              execCommand('insertHTML', textInput);
            }}>
              <Type className="h-4 w-4 mr-1" />
              Text Input
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const form = `<form style="border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 4px;"><h3>Form Title</h3><p>Name: <input type="text" style="margin-left: 10px; padding: 4px;"></p><p>Email: <input type="email" style="margin-left: 10px; padding: 4px;"></p><button type="submit" style="margin-top: 10px; padding: 8px 16px; background: #2196f3; color: white; border: none; border-radius: 4px;">Submit</button></form>`;
              execCommand('insertHTML', form);
            }}>
              <FileText className="h-4 w-4 mr-1" />
              Form
            </Button>
          </div>
        </TabsContent>

        {/* View Tab */}
        <TabsContent value="View" className="mt-0 border-b bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Button 
              variant={readingMode ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setReadingMode(!readingMode)}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Reading Mode
            </Button>
            <Button 
              variant={showRuler ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setShowRuler(!showRuler)}
            >
              <Grid className="h-4 w-4 mr-1" />
              Ruler
            </Button>
            <Button 
              variant={showGridlines ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setShowGridlines(!showGridlines)}
            >
              <Hash className="h-4 w-4 mr-1" />
              Gridlines
            </Button>
            <Select value={zoom.toString()} onValueChange={(value) => setZoom(parseInt(value))}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="75">75%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
                <SelectItem value="125">125%</SelectItem>
                <SelectItem value="150">150%</SelectItem>
                <SelectItem value="200">200%</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => {
              if (editorRef.current) {
                editorRef.current.style.columnCount = editorRef.current.style.columnCount === '2' ? '1' : '2';
                editorRef.current.style.columnGap = '20px';
              }
            }}>
              <Layout className="h-4 w-4 mr-1" />
              Multiple Pages
            </Button>
            <Button variant="ghost" size="sm" onClick={exportToPDF}>
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Print className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        </TabsContent>

        {/* Document Area */}
        <div className="flex-1 bg-gray-100 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto bg-white shadow-lg min-h-full" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
            {/* Page Header */}
            <div className="text-center py-4 border-b border-gray-200 text-gray-500 text-sm">
              Header - {title}
            </div>
            
            {/* Page Content */}
            <div
              ref={editorRef}
              contentEditable
              className="p-16 min-h-[800px] focus:outline-none"
              style={{
                fontFamily: 'Calibri, sans-serif',
                fontSize: '11pt',
                lineHeight: '1.15',
                color: '#000'
              }}
              onInput={handleContentChange}
              suppressContentEditableWarning={true}
            >
              {value || '<p>Start typing your document here...</p>'}
            </div>
            
            {/* Page Footer */}
            <div className="text-center py-4 border-t border-gray-200 text-gray-500 text-sm">
              Page 1 - Footer
            </div>
          </div>
        </div>
      </Tabs>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-blue-600 text-white text-sm">
        <div className="flex items-center gap-4">
          <span>Page 1 of 1</span>
          <span>Words: {wordCount}</span>
          {isTrackChanges && <span className="bg-yellow-500 text-black px-2 py-1 rounded">Track Changes ON</span>}
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-white p-1" onClick={() => setZoom(Math.max(50, zoom - 10))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span>{zoom}%</span>
          <Button variant="ghost" size="sm" className="text-white p-1" onClick={() => setZoom(Math.min(200, zoom + 10))}>
            <PlusCircle className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}