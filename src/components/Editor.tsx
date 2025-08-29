'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered, Table as TableIcon, Heading1, Heading2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface EditorProps {
  content?: any;
  onChange?: (content: any) => void;
  editable?: boolean;
}

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  const isMobile = useIsMobile();
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || '<p>Start writing...</p>',
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getJSON());
      }
    },
  });

  if (!editor) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-6">
        <div className="flex items-center justify-center h-[400px] text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      {editable && (
        <div className="border-b border-gray-200 p-2 sm:p-3 bg-gray-50/50">
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={editor.isActive('bold') ? 'default' : 'outline'}
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <Bold className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <Button
              variant={editor.isActive('italic') ? 'default' : 'outline'}
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <Italic className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <Button
              variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <Heading1 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <Button
              variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <Heading2 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <Button
              variant={editor.isActive('bulletList') ? 'default' : 'outline'}
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <List className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <Button
              variant={editor.isActive('orderedList') ? 'default' : 'outline'}
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <ListOrdered className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className={`${isMobile ? 'h-7 w-7' : 'h-8 w-8'} p-0`}
            >
              <TableIcon className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
          </div>
        </div>
      )}
      <div className={`${isMobile ? 'p-3' : 'p-6'}`}>
        <EditorContent 
          editor={editor} 
          className={`prose prose-sm max-w-none ${isMobile ? 'min-h-[300px]' : 'min-h-[400px]'} focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:${isMobile ? 'min-h-[300px]' : 'min-h-[400px]'} [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_td]:border [&_td]:border-gray-300 [&_td]:${isMobile ? 'p-1' : 'p-2'} [&_th]:border [&_th]:border-gray-300 [&_th]:${isMobile ? 'p-1' : 'p-2'} [&_th]:bg-gray-50`}
        />
      </div>
    </div>
  );
}