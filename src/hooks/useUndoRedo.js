/**
 * useUndoRedo — global keyboard handler for Ctrl+Z / Ctrl+Y.
 *
 * For M1, we implement a simple snapshot-based undo using full project clones.
 * (Immer patch-based undo is cleaner but more involved; snapshot is sufficient for M1.)
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/projectStore';

const MAX_HISTORY = 50;

let _snapshots = [];     // past project snapshots
let _redoStack  = [];    // redo stack

/** Call after every user-driven mutation to push a snapshot. */
export function pushSnapshot(project) {
  _snapshots.push(JSON.parse(JSON.stringify(project)));
  if (_snapshots.length > MAX_HISTORY) _snapshots.shift();
  _redoStack = [];
}

export function useUndoRedo() {
  const updateProject = useProjectStore(s => s.updateProject);
  const projectRef    = useRef(null);

  useEffect(() => {
    return useProjectStore.subscribe((state) => {
      projectRef.current = state.project;
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const isZ = e.key === 'z' || e.key === 'Z';
      const isY = e.key === 'y' || e.key === 'Y';
      const ctrl = e.ctrlKey || e.metaKey;

      if (!ctrl) return;

      if (isZ && !e.shiftKey) {
        // Undo
        if (_snapshots.length === 0) return;
        e.preventDefault();
        const prev = _snapshots.pop();
        if (projectRef.current) {
          _redoStack.push(JSON.parse(JSON.stringify(projectRef.current)));
        }
        updateProject((proj) => {
          Object.assign(proj, prev);
        });
      } else if (isY || (isZ && e.shiftKey)) {
        // Redo
        if (_redoStack.length === 0) return;
        e.preventDefault();
        const next = _redoStack.pop();
        if (projectRef.current) {
          _snapshots.push(JSON.parse(JSON.stringify(projectRef.current)));
        }
        updateProject((proj) => {
          Object.assign(proj, next);
        });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [updateProject]);
}
