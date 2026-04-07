import { create } from 'zustand';

// Editor state (UI state, selection, view transform, drag state)
export const useEditorStore = create((set) => ({
  selection: [], // array of node IDs
  toolMode: 'select', // 'select', 'add_vertex', 'remove_vertex'
  
  view: {
    zoom: 1,
    panX: 0,
    panY: 0,
  },

  dragState: {
    isDragging: false,
    partId: null,
    vertexIndex: null,
  },

  armedParameterId: null,

  setSelection: (nodeIds) => set({ selection: nodeIds }),
  setView: (view) => set((state) => ({ view: { ...state.view, ...view } })),
  setToolMode: (mode) => set({ toolMode: mode }),
  setDragState: (dragState) => set((state) => ({ dragState: { ...state.dragState, ...dragState } })),
  setArmedParameterId: (id) => set({ armedParameterId: id }),
}));
