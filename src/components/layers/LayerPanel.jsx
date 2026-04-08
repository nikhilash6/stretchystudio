import React, { useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';

/* ── Icons ────────────────────────────────────────────────────────────────── */

function PartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="10" height="10" rx="1"/>
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 6c1.5-3 8.5-3 10 0-1.5 3-8.5 3-10 0z"/>
      <circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 6c1.5-3 8.5-3 10 0"/>
      <line x1="2" y1="2" x2="10" y2="10"/>
    </svg>
  );
}

/* ── LayerRow ─────────────────────────────────────────────────────────────── */

export function LayerRow({ node, isSelected, onSelect, onMoveUp, onMoveDown, onToggleVisible }) {
  return (
    <div
      className={`
        flex items-center gap-1 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors select-none
        ${isSelected
          ? 'bg-primary/20 text-primary border border-primary/40'
          : 'hover:bg-muted text-foreground border border-transparent'
        }
      `}
      onClick={() => onSelect(node.id)}
    >
      {/* Type icon */}
      <span className="shrink-0 w-3 h-3 text-muted-foreground flex items-center">
        <PartIcon />
      </span>

      {/* Name */}
      <span
        className="flex-1 truncate font-mono text-xs"
        title={node.name || node.id}
      >
        {node.name || node.id}
      </span>

      {/* Visibility toggle */}
      <button
        className={`shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted-foreground/20 transition-colors ${
          node.visible === false ? 'text-muted-foreground/40' : 'text-muted-foreground'
        }`}
        onClick={(e) => { e.stopPropagation(); onToggleVisible(node.id); }}
        title="Toggle visibility"
      >
        <EyeIcon open={node.visible !== false} />
      </button>

      {/* Draw order (Z) with reorder buttons */}
      <div className="shrink-0 flex flex-col items-center" style={{ width: 28 }}>
        <button
          className="text-[9px] leading-none text-muted-foreground/60 hover:text-foreground px-0.5"
          onClick={(e) => { e.stopPropagation(); onMoveUp(node.id); }}
          title="Move up (higher draw order)"
        >▲</button>
        <span className="text-[10px] tabular-nums text-muted-foreground leading-none">
          {node.draw_order}
        </span>
        <button
          className="text-[9px] leading-none text-muted-foreground/60 hover:text-foreground px-0.5"
          onClick={(e) => { e.stopPropagation(); onMoveDown(node.id); }}
          title="Move down (lower draw order)"
        >▼</button>
      </div>
    </div>
  );
}

/* ── LayerPanel ───────────────────────────────────────────────────────────── */

export function LayerPanel() {
  const nodes         = useProjectStore(s => s.project.nodes);
  const updateProject = useProjectStore(s => s.updateProject);
  const selection     = useEditorStore(s => s.selection);
  const setSelection  = useEditorStore(s => s.setSelection);

  const sorted = [...nodes].sort((a, b) => b.draw_order - a.draw_order);

  const moveUp = useCallback((id) => {
    updateProject((proj) => {
      const node = proj.nodes.find(n => n.id === id);
      if (!node) return;
      // Find next-higher draw_order node and swap
      const above = proj.nodes
        .filter(n => n.draw_order > node.draw_order)
        .sort((a, b) => a.draw_order - b.draw_order)[0];
      if (above) {
        const tmp = above.draw_order;
        above.draw_order = node.draw_order;
        node.draw_order  = tmp;
      }
    });
  }, [updateProject]);

  const moveDown = useCallback((id) => {
    updateProject((proj) => {
      const node = proj.nodes.find(n => n.id === id);
      if (!node) return;
      const below = proj.nodes
        .filter(n => n.draw_order < node.draw_order)
        .sort((a, b) => b.draw_order - a.draw_order)[0];
      if (below) {
        const tmp = below.draw_order;
        below.draw_order = node.draw_order;
        node.draw_order  = tmp;
      }
    });
  }, [updateProject]);

  const toggleVisible = useCallback((id) => {
    updateProject((proj) => {
      const node = proj.nodes.find(n => n.id === id);
      if (node) node.visible = node.visible === false ? true : false;
    });
  }, [updateProject]);

  return (
    <div className="flex h-full flex-col">
      {/* Column headers */}
      <div className="flex items-center px-2 py-1 border-b text-[10px] text-muted-foreground font-medium shrink-0">
        <span className="w-3 mr-1" />
        <span className="flex-1">Layer</span>
        <span className="w-5 text-center">👁</span>
        <span className="w-7 text-center" title="Draw order">Z</span>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 text-center">No layers yet.</p>
        ) : (
          sorted.map(node => (
            <LayerRow
              key={node.id}
              node={node}
              isSelected={selection.includes(node.id)}
              onSelect={(id) => setSelection([id])}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
              onToggleVisible={toggleVisible}
            />
          ))
        )}
      </div>
    </div>
  );
}
