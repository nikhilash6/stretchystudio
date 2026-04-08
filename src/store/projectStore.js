import { create } from 'zustand';
import { produce } from 'immer';

// Project store (The .stretch model, undoable)
export const useProjectStore = create((set) => ({
  project: {
    version: "0.1",
    canvas: { width: 800, height: 600 },
    textures: [],     // { id, source (data URI or Blob URL) }
    nodes: [],        // flat array — see node schema below
    /*
      Node schema (type === 'part'):
      {
        id:         string,
        type:       'part',
        name:       string,          // display name (layer name from PSD, filename for PNG)
        parent:     string | null,
        draw_order: number,
        opacity:    number (0–1),
        visible:    boolean,
        clip_mask:  string | null,
        meshOpts:   {                // per-part mesh generation options
          alphaThreshold: number,
          smoothPasses:   number,
          gridSpacing:    number,
          edgePadding:    number,
          numEdgePoints:  number,
        } | null,                   // null = use editorStore.meshDefaults
        mesh:       object | null,  // { vertices, uvs, triangles, edgeIndices }
      }
    */
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
