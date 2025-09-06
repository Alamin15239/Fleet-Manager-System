'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, Link, Image, Table, Quote, Code, 
  Undo, Redo, Palette, Type, Subscript, Superscript, Highlighter, Copy, Cut, Paste
} from 'lucide-react';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value = '', onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState('12pt');
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');

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
    const rows = prompt('Number of rows:', '3');
    const cols = prompt('Number of columns:', '3');
    
    if (rows && cols) {
      let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;">';
      
      for (let i = 0; i < parseInt(rows); i++) {
        tableHTML += '<tr>';
        for (let j = 0; j < parseInt(cols); j++) {
          tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">${i === 0 ? `Header ${j + 1}` : `Cell ${i}-${j + 1}`}</td>`;
        }
        tableHTML += '</tr>';
      }
      
      tableHTML += '</table>';
      execCommand('insertHTML', tableHTML);
    }
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
          const img = `<img src="${imageUrl}" alt="Inserted image" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;" />`;
          execCommand('insertHTML', img);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    const text = prompt('Enter link text:');
    if (url && text) {
      const link = `<a href="${url}" style="color: #0066cc; text-decoration: underline;">${text}</a>`;
      execCommand('insertHTML', link);
    }
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
    
    // Apply custom styling
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

  const applyFontSize = (size: string) => {
    setFontSize(size);
    execCommand('fontSize', '3');
    
    // Apply custom font size
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = size;
        try {
          range.surroundContents(span);
        } catch (e) {
          span.innerHTML = range.toString();
          range.deleteContents();
          range.insertNode(span);
        }
      }
    }, 10);
  };

  const applyFontFamily = (family: string) => {
    setFontFamily(family);
    execCommand('fontName', family);
  };

  return (
    <div className={`border rounded-lg ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50/50">
        {/* Undo/Redo */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => execCommand('undo')} title="Undo">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('redo')} title="Redo">
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Font Family */}
        <Select value={fontFamily} onValueChange={applyFontFamily}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Calibri">Calibri</SelectItem>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
            <SelectItem value="Helvetica">Helvetica</SelectItem>
            <SelectItem value="Georgia">Georgia</SelectItem>
            <SelectItem value="Verdana">Verdana</SelectItem>
            <SelectItem value="Tahoma">Tahoma</SelectItem>
          </SelectContent>
        </Select>

        {/* Font Size */}
        <Select value={fontSize} onValueChange={applyFontSize}>
          <SelectTrigger className="w-16 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="8pt">8</SelectItem>
            <SelectItem value="9pt">9</SelectItem>
            <SelectItem value="10pt">10</SelectItem>
            <SelectItem value="11pt">11</SelectItem>
            <SelectItem value="12pt">12</SelectItem>
            <SelectItem value="14pt">14</SelectItem>
            <SelectItem value="16pt">16</SelectItem>
            <SelectItem value="18pt">18</SelectItem>
            <SelectItem value="20pt">20</SelectItem>
            <SelectItem value="24pt">24</SelectItem>
            <SelectItem value="28pt">28</SelectItem>
            <SelectItem value="36pt">36</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        {/* Headings */}
        <Select onValueChange={applyHeading}>
          <SelectTrigger className="w-24 h-8">
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

        <Separator orientation="vertical" className="h-6" />

        {/* Text Formatting */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => execCommand('bold')} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('italic')} title="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('underline')} title="Underline">
            <Underline className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('strikeThrough')} title="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('subscript')} title="Subscript">
            <Subscript className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('superscript')} title="Superscript">
            <Superscript className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Colors */}
        <div className="flex gap-1">
          <div className="flex items-center">
            <input 
              type="color" 
              value={textColor}
              onChange={(e) => {
                setTextColor(e.target.value);
                execCommand('foreColor', e.target.value);
              }}
              className="w-8 h-8 border rounded cursor-pointer"
              title="Text Color"
            />
          </div>
          <div className="flex items-center">
            <input 
              type="color" 
              value={backgroundColor}
              onChange={(e) => {
                setBackgroundColor(e.target.value);
                execCommand('hiliteColor', e.target.value);
              }}
              className="w-8 h-8 border rounded cursor-pointer"
              title="Highlight Color"
            />
          </div>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Alignment */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyLeft')} title="Align Left">
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyCenter')} title="Center">
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyRight')} title="Align Right">
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('justifyFull')} title="Justify">
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Lists */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('indent')} title="Increase Indent">
            <Indent className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('outdent')} title="Decrease Indent">
            <Outdent className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Insert Elements */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={insertLink} title="Insert Link">
            <Link className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={insertImage} title="Insert Image">
            <Image className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={insertTable} title="Insert Table">
            <Table className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => execCommand('formatBlock', 'blockquote')} title="Quote">
            <Quote className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[400px] p-4 focus:outline-none prose max-w-none"
        style={{
          fontFamily: 'Calibri, sans-serif',
          fontSize: '11pt',
          lineHeight: '1.15',
          color: '#000'
        }}
        onInput={handleContentChange}
        onPaste={(e) => {
          // Allow pasting but clean up the content
          setTimeout(handleContentChange, 10);
        }}
        dangerouslySetInnerHTML={{ __html: value }}
        suppressContentEditableWarning={true}
        data-placeholder={placeholder}
      />
    </div>
  );
}