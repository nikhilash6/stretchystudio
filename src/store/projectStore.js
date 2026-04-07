import { create } from 'zustand';
import { produce } from 'immer';

// Project store (The .stretch model, undoable)
export const useProjectStore = create((set) => ({
  project: {
    version: "0.1",
    canvas: { width: 800, height: 600 },
    textures: [],     // { id, source (data URI or Blob URL) }
    nodes: [],        // flat array of { id, type, parent, draw_order, opacity, clip_mask, ... }
    parameters: [],   // { id, label, min, max, default, value, keys: [...] }
    physics_groups: [],
    animations: []
  },
  
  // Versions used to trigger rendering passes independently of React
  versionControl: {
    geometryVersion: 0,
    transformVersion: 0,
    textureVersion: 0,
  },

  // Actions wrapped in immer
  updateProject: (recipe) => set(produce((state) => {
    recipe(state.project, state.versionControl);
  }))
}));
