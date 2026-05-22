import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import TableContextMenu from '@/components/editor/TableContextMenu';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { uploadImageToServer } from '@/services/cloudinary';
import { reportError } from '@/lib/monitoring';
import {
  BLOG_TABLE_BODY_CELL_CLASS,
  BLOG_TABLE_CLASS,
  BLOG_TABLE_HEADER_CELL_CLASS,
  clampTableDimension,
  TABLE_COLS_MAX,
  TABLE_ROWS_MAX,
} from '@/lib/blogs/blogTableTailwind';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Table as TableIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const tableExtensions = [
  Table.configure({
    resizable: true,
    HTMLAttributes: { class: BLOG_TABLE_CLASS },
  }),
  TableRow,
  TableHeader.configure({
    HTMLAttributes: { class: BLOG_TABLE_HEADER_CELL_CLASS },
  }),
  TableCell.configure({
    HTMLAttributes: { class: BLOG_TABLE_BODY_CELL_CLASS },
  }),
];

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');
  const [tableWithHeader, setTableWithHeader] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ...tableExtensions,
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose max-w-none focus:outline-none min-h-[300px] p-4 text-gray-900 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2',
      },
    },
  });

  const addImage = useCallback(async () => {
    if (typeof document === 'undefined') {
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const url = await uploadImageToServer(file);
          editor?.chain().focus().setImage({ src: url }).run();
        } catch (error) {
          reportError(error, { source: 'RichTextEditor.addImage' });
          alert('Failed to upload image. Try again.');
        }
      }
    };
    input.click();
  }, [editor]);

  const setLink = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const confirmInsertTable = useCallback(() => {
    const rows = clampTableDimension(tableRows, TABLE_ROWS_MAX);
    const cols = clampTableDimension(tableCols, TABLE_COLS_MAX);
    editor
      ?.chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: tableWithHeader })
      .run();
    setTablePickerOpen(false);
  }, [editor, tableRows, tableCols, tableWithHeader]);

  if (!editor) return null;

  const MenuBarItem = ({
    onClick,
    isActive = false,
    disabled = false,
    icon: Icon,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-100 transition ${isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <>
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white flex flex-col">
      <div className="relative flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <MenuBarItem onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={Bold} title="Bold" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={Italic} title="Italic" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={UnderlineIcon} title="Underline" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={Strikethrough} title="Strikethrough" />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuBarItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Heading 1" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Heading 2" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} icon={Heading3} title="Heading 3" />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} icon={AlignLeft} title="Align Left" />
        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} icon={AlignCenter} title="Align Center" />
        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} icon={AlignRight} title="Align Right" />
        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} icon={AlignJustify} title="Justify" />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuBarItem onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon={List} title="Bullet List" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} icon={ListOrdered} title="Ordered List" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon={Quote} title="Quote" />

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuBarItem onClick={setLink} isActive={editor.isActive('link')} icon={LinkIcon} title="Link" />
        <MenuBarItem onClick={addImage} icon={ImageIcon} title="Insert Image" />

        <div className="relative">
          <MenuBarItem
            onClick={() => setTablePickerOpen((open) => !open)}
            isActive={tablePickerOpen}
            icon={TableIcon}
            title="Insert table"
          />
          {tablePickerOpen && (
            <div
              className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
              role="dialog"
              aria-label="Insert table"
            >
              <p className="text-xs font-semibold text-gray-800 mb-2">Table size</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-600">
                  Rows (1–{TABLE_ROWS_MAX})
                  <input
                    type="number"
                    min={1}
                    max={TABLE_ROWS_MAX}
                    value={tableRows}
                    onChange={(e) => setTableRows(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  Columns (1–{TABLE_COLS_MAX})
                  <input
                    type="number"
                    min={1}
                    max={TABLE_COLS_MAX}
                    value={tableCols}
                    onChange={(e) => setTableCols(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={tableWithHeader}
                  onChange={(e) => setTableWithHeader(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Header row
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={confirmInsertTable}
                  className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => setTablePickerOpen(false)}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1 ml-auto" />

        <MenuBarItem onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={Undo} title="Undo" />
        <MenuBarItem onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={Redo} title="Redo" />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <EditorContent editor={editor} />
        <TableContextMenu editor={editor} />
      </div>

      <style jsx global>{`
        .ProseMirror .selectedCell {
          background-color: rgb(219 234 254);
          outline: 2px solid rgb(59 130 246);
          outline-offset: -2px;
        }
        .ProseMirror tr.table-axis-row-selected th,
        .ProseMirror tr.table-axis-row-selected td {
          background-color: rgb(207 250 254) !important;
          box-shadow: inset 0 0 0 2px rgb(6 182 212);
        }
        .ProseMirror th.table-axis-col-selected,
        .ProseMirror td.table-axis-col-selected {
          background-color: rgb(237 233 254) !important;
          box-shadow: inset 0 0 0 2px rgb(139 92 246);
        }
        .ProseMirror .column-resize-handle {
          background-color: rgb(59 130 246);
          width: 4px;
        }
        .prose h1 {
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 0.5em;
          margin-top: 1em;
        }
        .prose h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-bottom: 0.5em;
          margin-top: 0.75em;
        }
        .prose h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        .prose p {
          margin-bottom: 1em;
        }
        .prose ul {
          list-style-type: disc;
          padding-left: 2em;
          margin-bottom: 1em;
        }
        .prose ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin-bottom: 1em;
        }
        .prose blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          color: #6b7280;
          font-style: italic;
        }
        .prose a {
          color: #2563eb;
          text-decoration: underline;
        }
        .prose img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
    <TableContextMenu editor={editor} />
    </>
  );
}
