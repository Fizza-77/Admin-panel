import type { Editor } from '@tiptap/react';

const ROW_CLASS = 'table-axis-row-selected';
const COL_CLASS = 'table-axis-col-selected';

function clearHighlights(root: HTMLElement) {
  root.querySelectorAll(`.${ROW_CLASS}`).forEach((el) => el.classList.remove(ROW_CLASS));
  root.querySelectorAll(`.${COL_CLASS}`).forEach((el) => el.classList.remove(COL_CLASS));
}

export function getActiveCellElement(editor: Editor): HTMLTableCellElement | null {
  const { from } = editor.state.selection;
  const domAt = editor.view.domAtPos(from);
  let node: Node | null = domAt.node;

  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const cell = node.closest('td, th');
  return cell instanceof HTMLTableCellElement ? cell : null;
}

/** Highlights the row or column of the currently selected cell. */
export function syncTableAxisHighlight(editor: Editor, axis: 'row' | 'column' | null) {
  const root = editor.view.dom;
  clearHighlights(root);

  if (!axis || !editor.isActive('table')) {
    return;
  }

  const cell = getActiveCellElement(editor);
  if (!cell) {
    return;
  }

  if (axis === 'row') {
    cell.parentElement?.classList.add(ROW_CLASS);
    return;
  }

  const table = cell.closest('table');
  const colIndex = cell.cellIndex;
  if (!table || colIndex < 0) {
    return;
  }

  table.querySelectorAll('tr').forEach((tr) => {
    const target = tr.children.item(colIndex);
    if (target) {
      target.classList.add(COL_CLASS);
    }
  });
}

export function clearTableAxisHighlight(editor: Editor) {
  clearHighlights(editor.view.dom);
}

export function getCellIndices(cell: HTMLTableCellElement): { rowIndex: number; colIndex: number } {
  const table = cell.closest('table');
  const tr = cell.parentElement;
  const rowIndex =
    table && tr instanceof HTMLTableRowElement ? Array.from(table.rows).indexOf(tr) : -1;
  return { rowIndex, colIndex: cell.cellIndex };
}

export function getRowAnchorRect(cell: HTMLTableCellElement): DOMRect {
  const tr = cell.parentElement;
  if (tr instanceof HTMLTableRowElement) {
    return tr.getBoundingClientRect();
  }
  return cell.getBoundingClientRect();
}

export function getColumnAnchorRect(cell: HTMLTableCellElement): DOMRect {
  const table = cell.closest('table');
  const colIndex = cell.cellIndex;
  if (!table || colIndex < 0) {
    return cell.getBoundingClientRect();
  }
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  table.querySelectorAll('tr').forEach((tr) => {
    const c = tr.children.item(colIndex);
    if (c instanceof HTMLElement) {
      const r = c.getBoundingClientRect();
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
  });
  if (top === Infinity) {
    return cell.getBoundingClientRect();
  }
  return new DOMRect(left, top, right - left, cell.getBoundingClientRect().height);
}
