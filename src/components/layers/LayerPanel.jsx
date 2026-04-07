import React from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useEditorStore } from '@/store/editorStore';

export function LayerRow({ node, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(node.id)}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-sm rounded text-left transition-colors
        ${isSelected
          ? 'bg-primary/20 text-primary border border-primary/40'
          : 'hover:bg-muted text-foreground border border-transparent'
        }
      `}
    >
      {/* Type icon */}
      <span className="shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground">
        {node.type === 'part' ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 3h10M1 6h10M1 9h10" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        )}
      </span>

      {/* Name */}
      <span className="flex-1 truncate font-mono text-xs">{node.id}</span>

      {/* Draw order */}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums w-6 text-right">
        {node.draw_order}
      </span>
    </button>
  );
}

export function LayerPanel() {
  const nodes     = useProjectStore(s => s.project.nodes);
  const selection = useEditorStore(s => s.selection);
  const setSelection = useEditorStore(s => s.setSelection);

  const sorted = [...nodes].sort((a, b) => b.draw_order - a.draw_order);

  return (
    <div className="flex h-full flex-col">
      {/* Header row with column labels */}
      <div className="flex items-center px-3 py-2 border-b text-xs text-muted-foreground font-medium shrink-0">
        <span className="w-4 mr-2" />
        <span className="flex-1">Layer</span>
        <span className="w-6 text-right" title="Draw order">Z</span>
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
            />
          ))
        )}
      </div>
    </div>
  );
}
