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
          'blog-editor-prose max-w-none focus:outline-none [&_table]:w-full [&_table]:border-collapse',
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
      className={`blog-editor-rte-btn ${isActive ? 'blog-editor-rte-btn--active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <>
    <div className="blog-editor-rte">
      <div className="blog-editor-rte-toolbar">
        <MenuBarItem onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={Bold} title="Bold" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={Italic} title="Italic" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={UnderlineIcon} title="Underline" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={Strikethrough} title="Strikethrough" />

        <div className="blog-editor-rte-divider" />

        <MenuBarItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Heading 1" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Heading 2" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} icon={Heading3} title="Heading 3" />

        <div className="blog-editor-rte-divider" />

        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} icon={AlignLeft} title="Align Left" />
        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} icon={AlignCenter} title="Align Center" />
        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} icon={AlignRight} title="Align Right" />
        <MenuBarItem onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} icon={AlignJustify} title="Justify" />

        <div className="blog-editor-rte-divider" />

        <MenuBarItem onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon={List} title="Bullet List" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} icon={ListOrdered} title="Ordered List" />
        <MenuBarItem onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon={Quote} title="Quote" />

        <div className="blog-editor-rte-divider" />

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
              className="blog-editor-rte-popover"
              role="dialog"
              aria-label="Insert table"
            >
              <p className="blog-editor-rte-popover-title">Table size</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="blog-editor-rte-popover-label">
                  Rows (1–{TABLE_ROWS_MAX})
                  <input
                    type="number"
                    min={1}
                    max={TABLE_ROWS_MAX}
                    value={tableRows}
                    onChange={(e) => setTableRows(e.target.value)}
                    className="blog-editor-rte-popover-input"
                  />
                </label>
                <label className="blog-editor-rte-popover-label">
                  Columns (1–{TABLE_COLS_MAX})
                  <input
                    type="number"
                    min={1}
                    max={TABLE_COLS_MAX}
                    value={tableCols}
                    onChange={(e) => setTableCols(e.target.value)}
                    className="blog-editor-rte-popover-input"
                  />
                </label>
              </div>
              <label className="blog-editor-rte-popover-check">
                <input
                  type="checkbox"
                  checked={tableWithHeader}
                  onChange={(e) => setTableWithHeader(e.target.checked)}
                />
                Header row
              </label>
              <div className="blog-editor-rte-popover-actions">
                <button
                  type="button"
                  onClick={confirmInsertTable}
                  className="blog-editor-rte-popover-btn blog-editor-rte-popover-btn--primary"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => setTablePickerOpen(false)}
                  className="blog-editor-rte-popover-btn blog-editor-rte-popover-btn--ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="blog-editor-rte-divider ml-auto" />

        <MenuBarItem onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={Undo} title="Undo" />
        <MenuBarItem onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={Redo} title="Redo" />
      </div>

      <div className="blog-editor-rte-content flex-1 overflow-y-auto overflow-x-auto">
        <EditorContent editor={editor} />
        <TableContextMenu editor={editor} />
      </div>
    </div>
    </>
  );
}
