import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { ScenePass } from '@/renderer/scenePass';

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────── */

/** Convert client coords → canvas-space (image/mesh pixel coords) */
function clientToCanvasSpace(canvas, clientX, clientY, view) {
  const rect = canvas.getBoundingClientRect();
  const cx = (clientX - rect.left) / view.zoom - view.panX / view.zoom;
  const cy = (clientY - rect.top)  / view.zoom - view.panY / view.zoom;
  return [cx, cy];
}

/**
 * Find the vertex index closest to (x, y) within `radius` pixels.
 * Returns -1 if none found.
 */
function findNearestVertex(vertices, x, y, radius) {
  const r2 = radius * radius;
  let best = -1, bestD = r2;
  for (let i = 0; i < vertices.length; i++) {
    const dx = vertices[i].x - x;
    const dy = vertices[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { best = i; bestD = d; }
  }
  return best;
}

/** Generate a short unique id */
function uid() { return Math.random().toString(36).slice(2, 9); }

/* ──────────────────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────────────────── */

export default function CanvasViewport() {
  const canvasRef  = useRef(null);
  const sceneRef   = useRef(null);   // ScenePass instance
  const rafRef     = useRef(null);
  const workerRef  = useRef(null);
  const dragRef    = useRef(null);   // { partId, vertexIndex, offsetX, offsetY }
  const isDirtyRef = useRef(true);

  const project     = useProjectStore(s => s.project);
  const updateProject = useProjectStore(s => s.updateProject);
  const editorState = useEditorStore();
  const { setDragState, setSelection } = editorState;

  // Keep a stable ref to live state for imperative callbacks
  const editorRef   = useRef(editorState);
  const projectRef  = useRef(project);
  useEffect(() => { editorRef.current = editorState; }, [editorState]);
  useEffect(() => { projectRef.current = project; isDirtyRef.current = true; }, [project]);

  /* ── WebGL init ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: false });
    if (!gl) {
      console.error('[CanvasViewport] WebGL2 not supported');
      return;
    }

    try {
      sceneRef.current = new ScenePass(gl);
    } catch (err) {
      console.error('[CanvasViewport] ScenePass init failed:', err);
      return;
    }

    // rAF loop — only redraws when dirty
    const tick = () => {
      if (isDirtyRef.current && sceneRef.current) {
        sceneRef.current.draw(projectRef.current, editorRef.current);
        isDirtyRef.current = false;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mark dirty when editor view changes ─────────────────────────────── */
  useEffect(() => { isDirtyRef.current = true; }, [editorState.view, editorState.selection]);

  /* ── Mesh worker factory ─────────────────────────────────────────────── */
  const dispatchMeshWorker = useCallback((partId, imageData, opts) => {
    if (workerRef.current) workerRef.current.terminate();

    const worker = new Worker(new URL('@/mesh/worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (!e.data.ok) {
        console.error('[MeshWorker]', e.data.error);
        return;
      }
      const { vertices, uvs, triangles, edgeIndices } = e.data;

      // Upload to GPU
      const scene = sceneRef.current;
      if (scene) {
        scene.parts.uploadMesh(partId, { vertices, uvs, triangles, edgeIndices });
        isDirtyRef.current = true;
      }

      // Store mesh data in projectStore
      updateProject((proj) => {
        const node = proj.nodes.find(n => n.id === partId);
        if (node) {
          node.mesh = { vertices, uvs: Array.from(uvs), triangles, edgeIndices };
        }
      });
    };

    worker.postMessage({ imageData, opts });
  }, [updateProject]);

  /* ── Drag-and-drop PNG import ────────────────────────────────────────── */
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const url = URL.createObjectURL(file);
    const img  = new Image();
    img.onload = () => {
      const partId = uid();

      // Draw to offscreen canvas to read pixel data
      const offscreen = document.createElement('canvas');
      offscreen.width  = img.width;
      offscreen.height = img.height;
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      // Register in project store
      updateProject((proj, ver) => {
        proj.canvas.width  = img.width;
        proj.canvas.height = img.height;

        proj.textures.push({ id: partId, source: url });

        proj.nodes.push({
          id:         partId,
          type:       'part',
          parent:     null,
          draw_order: proj.nodes.length,
          opacity:    1,
          clip_mask:  null,
          mesh:       null,
        });

        ver.textureVersion++;
      });

      // Upload texture to GPU immediately
      const scene = sceneRef.current;
      if (scene) {
        scene.parts.uploadTexture(partId, img);
        isDirtyRef.current = true;
      }

      // Kick off mesh generation in worker
      dispatchMeshWorker(partId, imageData, {
        alphaThreshold: 20,
        smoothPasses:   3,
        gridSpacing:    30,
        edgePadding:    8,
        numEdgePoints:  80,
      });

      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [updateProject, dispatchMeshWorker]);

  const onDragOver = useCallback((e) => { e.preventDefault(); }, []);

  /* ── Pointer events (vertex drag) ────────────────────────────────────── */
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    const { view } = editorRef.current;
    const [cx, cy] = clientToCanvasSpace(canvas, e.clientX, e.clientY, view);

    // Find part with mesh closest to click
    const proj = projectRef.current;
    for (const node of [...proj.nodes].reverse()) {
      if (node.type !== 'part' || !node.mesh) continue;
      const idx = findNearestVertex(node.mesh.vertices, cx, cy, 14 / view.zoom);
      if (idx >= 0) {
        dragRef.current = {
          partId: node.id,
          vertexIndex: idx,
          offsetX: cx - node.mesh.vertices[idx].x,
          offsetY: cy - node.mesh.vertices[idx].y,
        };
        setSelection([node.id]);
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        return;
      }
    }
    setSelection([]);
  }, [setSelection]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    const { view } = editorRef.current;
    const [cx, cy] = clientToCanvasSpace(canvas, e.clientX, e.clientY, view);
    const { partId, vertexIndex, offsetX, offsetY } = dragRef.current;

    updateProject((proj) => {
      const node = proj.nodes.find(n => n.id === partId);
      if (!node?.mesh) return;
      node.mesh.vertices[vertexIndex].x = cx - offsetX;
      node.mesh.vertices[vertexIndex].y = cy - offsetY;
    });

    // Re-upload positions to GPU (hot path)
    const scene = sceneRef.current;
    if (scene) {
      const node = projectRef.current.nodes.find(n => n.id === partId);
      if (node?.mesh) {
        const uvs = new Float32Array(node.mesh.uvs);
        scene.parts.uploadPositions(partId, node.mesh.vertices, uvs);
        isDirtyRef.current = true;
      }
    }
  }, [updateProject]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const canvas = canvasRef.current;
    canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = 'crosshair';
  }, []);

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-[#1a1a1a]"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Drop hint overlay — shown when no nodes */}
      {project.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p className="text-muted-foreground/60 text-sm font-medium select-none">
            Drop a PNG here to begin
          </p>
        </div>
      )}
    </div>
  );
}
