'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  clearTableAxisHighlight,
  getActiveCellElement,
  getCellIndices,
  getColumnAnchorRect,
  getRowAnchorRect,
  syncTableAxisHighlight,
} from '@/lib/editor/tableAxisHighlight';
import { Trash2, X } from 'lucide-react';

type TableAxis = 'row' | 'column';

type TableContextMenuProps = {
  editor: Editor;
};

function isInTable(editor: Editor): boolean {
  return (
    editor.isActive('table') ||
    editor.isActive('tableCell') ||
    editor.isActive('tableHeader')
  );
}

function MenuButton({
  onClick,
  disabled,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === 'danger'
          ? 'text-red-700 hover:bg-red-50'
          : 'text-gray-800 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

export default function TableContextMenu({ editor }: TableContextMenuProps) {
  const [axis, setAxis] = useState<TableAxis | null>(null);
  const [selectionIndex, setSelectionIndex] = useState<{ row: number; col: number } | null>(null);
  const [gutterAnchor, setGutterAnchor] = useState<{ row: DOMRect; col: DOMRect } | null>(null);
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const gutterPickRef = useRef(false);

  const clearSelection = useCallback(() => {
    setAxis(null);
    setSelectionIndex(null);
    setActionAnchor(null);
    clearTableAxisHighlight(editor);
  }, [editor]);

  const syncGutters = useCallback(() => {
    if (!isInTable(editor)) {
      setGutterAnchor(null);
      clearSelection();
      return;
    }

    const cell = getActiveCellElement(editor);
    if (!cell) {
      setGutterAnchor(null);
      return;
    }

    setGutterAnchor({
      row: getRowAnchorRect(cell),
      col: getColumnAnchorRect(cell),
    });

    if (axis && selectionIndex) {
      const { rowIndex, colIndex } = getCellIndices(cell);
      const rowChanged = axis === 'row' && rowIndex !== selectionIndex.row;
      const colChanged = axis === 'column' && colIndex !== selectionIndex.col;
      if (rowChanged || colChanged) {
        clearSelection();
        return;
      }
      setActionAnchor(axis === 'row' ? getRowAnchorRect(cell) : getColumnAnchorRect(cell));
      syncTableAxisHighlight(editor, axis);
    }
  }, [editor, axis, selectionIndex, clearSelection]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    syncGutters();
    const onUpdate = () => {
      if (gutterPickRef.current) {
        return;
      }
      syncGutters();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!axis) {
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        clearSelection();
      }
    };

    editor.on('selectionUpdate', onUpdate);
    editor.on('transaction', onUpdate);
    editor.on('blur', clearSelection);
    editor.view.dom.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onUpdate, true);

    return () => {
      editor.off('selectionUpdate', onUpdate);
      editor.off('transaction', onUpdate);
      editor.off('blur', clearSelection);
      editor.view.dom.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onUpdate, true);
      clearTableAxisHighlight(editor);
    };
  }, [editor, axis, syncGutters, clearSelection]);

  const selectAxis = (next: TableAxis) => {
    const cell = getActiveCellElement(editor);
    if (!cell) {
      return;
    }
    gutterPickRef.current = true;
    const indices = getCellIndices(cell);
    setSelectionIndex({ row: indices.rowIndex, col: indices.colIndex });
    setAxis(next);
    syncTableAxisHighlight(editor, next);
    setActionAnchor(next === 'row' ? getRowAnchorRect(cell) : getColumnAnchorRect(cell));
    requestAnimationFrame(() => {
      gutterPickRef.current = false;
    });
  };

  const runAndKeepFocus = (fn: () => void) => {
    fn();
    if (axis) {
      requestAnimationFrame(() => {
        syncTableAxisHighlight(editor, axis);
        syncGutters();
      });
    }
  };

  if (!mounted) {
    return null;
  }

  const portals: React.ReactNode[] = [];

  if (gutterAnchor && !axis) {
    const rowBtnTop = gutterAnchor.row.top + gutterAnchor.row.height / 2;
    const rowBtnLeft = gutterAnchor.row.left - 8;
    const colBtnTop = gutterAnchor.col.top - 8;
    const colBtnLeft = gutterAnchor.col.left + gutterAnchor.col.width / 2;

    portals.push(
      <div
        key="row-picker"
        className="fixed z-[9998] -translate-x-full -translate-y-1/2"
        style={{ top: rowBtnTop, left: rowBtnLeft }}
      >
        <button
          type="button"
          title="Select row"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectAxis('row')}
          className="rounded-md border border-cyan-300 bg-cyan-600 px-2 py-1 text-[10px] font-bold text-white shadow-md hover:bg-cyan-700"
        >
          Row
        </button>
      </div>,
      <div
        key="col-picker"
        className="fixed z-[9998] -translate-x-1/2 -translate-y-full"
        style={{ top: colBtnTop, left: colBtnLeft }}
      >
        <button
          type="button"
          title="Select column"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectAxis('column')}
          className="rounded-md border border-violet-300 bg-violet-600 px-2 py-1 text-[10px] font-bold text-white shadow-md hover:bg-violet-700"
        >
          Col
        </button>
      </div>,
    );
  }

  if (axis && actionAnchor) {
    const top = Math.max(8, actionAnchor.top - 8);
    const left = actionAnchor.left + actionAnchor.width / 2;

    portals.push(
      <div
        key="actions"
        role="toolbar"
        aria-label="Table row/column actions"
        className="fixed z-[9999] -translate-x-1/2 -translate-y-full"
        style={{ top, left }}
      >
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 shadow-xl">
          <div className="flex items-center justify-between gap-2 px-1">
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                axis === 'row' ? 'text-cyan-900' : 'text-violet-900'
              }`}
            >
              {axis === 'row' ? 'Row selected' : 'Column selected'}
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearSelection}
              className="p-0.5 text-gray-400 hover:text-gray-700"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1 max-w-[300px]">
            {axis === 'row' ? (
              <>
                <MenuButton onClick={() => runAndKeepFocus(() => editor.chain().focus().addRowBefore().run())}>
                  + Row above
                </MenuButton>
                <MenuButton onClick={() => runAndKeepFocus(() => editor.chain().focus().addRowAfter().run())}>
                  + Row below
                </MenuButton>
                <MenuButton
                  variant="danger"
                  disabled={!editor.can().deleteRow()}
                  onClick={() => runAndKeepFocus(() => editor.chain().focus().deleteRow().run())}
                >
                  Delete row
                </MenuButton>
              </>
            ) : (
              <>
                <MenuButton onClick={() => runAndKeepFocus(() => editor.chain().focus().addColumnBefore().run())}>
                  + Col left
                </MenuButton>
                <MenuButton onClick={() => runAndKeepFocus(() => editor.chain().focus().addColumnAfter().run())}>
                  + Col right
                </MenuButton>
                <MenuButton
                  variant="danger"
                  disabled={!editor.can().deleteColumn()}
                  onClick={() => runAndKeepFocus(() => editor.chain().focus().deleteColumn().run())}
                >
                  Delete column
                </MenuButton>
              </>
            )}
          </div>
          <div className="border-t border-gray-100 pt-1">
            <MenuButton
              variant="danger"
              onClick={() => {
                editor.chain().focus().deleteTable().run();
                clearSelection();
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                Delete table
              </span>
            </MenuButton>
          </div>
        </div>
      </div>,
    );
  }

  if (portals.length === 0) {
    return null;
  }

  return createPortal(<>{portals}</>, document.body);
}
