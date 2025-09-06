'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, Link, Image, Table, Quote, Code, 
  Undo, Redo, Palette, Type, Subscript, Superscript, Highlighter, Copy, Cut, Paste,
  Save, FileText, Download, Print, Share, Search, Replace, Zoom
} from 'lucide-react';

interface WordEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
}

export default function WordEditor({ value = '', onChange, title = 'Document', onTitleChange }: WordEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState('11');
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [activeTab, setActiveTab] = useState('Home');

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
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
    }
  };

  const insertTable = () => {
    const tableHTML = `
      <table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #d1d5db;">
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px; min-width: 100px;">Header 1</td>
          <td style="border: 1px solid #d1d5db; padding: 8px; min-width: 100px;">Header 2</td>
          <td style="border: 1px solid #d1d5db; padding: 8px; min-width: 100px;">Header 3</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px;">Cell 1</td>
          <td style="border: 1px solid #d1d5db; padding: 8px;">Cell 2</td>
          <td style="border: 1px solid #d1d5db; padding: 8px;">Cell 3</td>
        </tr>
      </table>
    `;
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
          const img = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; height: auto; margin: 10px 0;" />`;
          execCommand('insertHTML', img);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const applyHeading = (level: string) => {
    execCommand('formatBlock', `<${level}>`);
  };

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
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
            <Share className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
      </div>

      {/* Ribbon Tabs */}
      <div className="flex items-center px-4 py-1 bg-gray-50 border-b">
        {['Home', 'Insert', 'Layout', 'Review'].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="mr-1"
          >
            {tab}
          </Button>
        ))}
      </div>

      {/* Ribbon Content */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        {activeTab === 'Home' && (
          <div className="flex items-center gap-1 flex-wrap">
            {/* Clipboard */}
            <div className="flex items-center gap-1 mr-4">
              <Button variant="ghost" size="sm" onClick={() => execCommand('cut')}>
                <Cut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => execCommand('copy')}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => execCommand('paste')}>
                <Paste className="h-4 w-4" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-8 mr-4" />

            {/* Font */}
            <Select value={fontFamily} onValueChange={(value) => { setFontFamily(value); execCommand('fontName', value); }}>
              <SelectTrigger className="w-32 h-8">
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
              <SelectTrigger className="w-16 h-8">
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

            <Separator orientation="vertical" className="h-8 mx-2" />

            {/* Formatting */}
            <Button variant="ghost" size="sm" onClick={() => execCommand('bold')}>
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('italic')}>
              <Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('underline')}>
              <Underline className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('strikeThrough')}>
              <Strikethrough className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8 mx-2" />

            {/* Alignment */}
            <Button variant="ghost" size="sm" onClick={() => execCommand('justifyLeft')}>
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('justifyCenter')}>
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('justifyRight')}>
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('justifyFull')}>
              <AlignJustify className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8 mx-2" />

            {/* Lists */}
            <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')}>
              <ListOrdered className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-8 mx-2" />

            {/* Styles */}
            <Select onValueChange={applyHeading}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p">Normal</SelectItem>
                <SelectItem value="h1">Heading 1</SelectItem>
                <SelectItem value="h2">Heading 2</SelectItem>
                <SelectItem value="h3">Heading 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {activeTab === 'Insert' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={insertTable}>
              <Table className="h-4 w-4 mr-1" />
              Table
            </Button>
            <Button variant="ghost" size="sm" onClick={insertImage}>
              <Image className="h-4 w-4 mr-1" />
              Picture
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              const url = prompt('Enter URL:');
              const text = prompt('Enter link text:');
              if (url && text) {
                execCommand('insertHTML', `<a href="${url}">${text}</a>`);
              }
            }}>
              <Link className="h-4 w-4 mr-1" />
              Link
            </Button>
          </div>
        )}
      </div>

      {/* Document Area */}
      <div className="flex-1 bg-gray-100 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto bg-white shadow-lg min-h-full">
          {/* Page */}
          <div
            ref={editorRef}
            contentEditable
            className="p-16 min-h-full focus:outline-none"
            style={{
              fontFamily: 'Calibri, sans-serif',
              fontSize: '11pt',
              lineHeight: '1.15',
              color: '#000'
            }}
            onInput={handleContentChange}
            dangerouslySetInnerHTML={{ __html: value }}
            suppressContentEditableWarning={true}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-blue-600 text-white text-sm">
        <div>Page 1 of 1</div>
        <div className="flex items-center gap-4">
          <span>Words: 0</span>
          <div className="flex items-center gap-1">
            <Zoom className="h-3 w-3" />
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}