/**
 * ScenePass — orchestrates the full render pass.
 *
 * - Sorts parts by draw_order
 * - Builds MVP matrix from view (zoom/pan) + identity world transform (M3+)
 * - Issues draw calls via PartRenderer
 * - Respects editor.overlays for global visibility toggles
 * - Respects node.visible for per-part visibility
 */
import { createProgram } from './program.js';
import { MESH_VERT, MESH_FRAG, WIRE_VERT, WIRE_FRAG } from './shaders/mesh.js';
import { PartRenderer } from './partRenderer.js';

/**
 * Build a column-major 3×3 MVP matrix for 2D.
 *
 * Maps image pixels → NDC [-1,1]:
 *   scale by zoom, translate by pan, then flip Y and normalise by canvas size.
 *
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} zoom
 * @param {number} panX
 * @param {number} panY
 * @returns {Float32Array} 9-element column-major mat3
 */
function buildMVP(canvasW, canvasH, zoom, panX, panY) {
  const sx = (2 * zoom) / canvasW;
  const sy = -(2 * zoom) / canvasH; // flip Y (WebGL Y is up)
  const tx = (panX / canvasW) * 2 - 1;
  const ty = 1 - (panY / canvasH) * 2;

  // Column-major mat3:
  // [ sx   0  0 ]
  // [  0  sy  0 ]
  // [ tx  ty  1 ]
  return new Float32Array([
    sx,  0,   0,
    0,   sy,  0,
    tx,  ty,  1,
  ]);
}

export class ScenePass {
  /**
   * @param {WebGL2RenderingContext} gl
   */
  constructor(gl) {
    this.gl = gl;

    const meshProg = createProgram(gl, MESH_VERT, MESH_FRAG);
    const wireProg = createProgram(gl, WIRE_VERT, WIRE_FRAG);

    this.meshProgram  = meshProg.program;
    this.meshUniforms = meshProg.uniforms;
    this.wireProgram  = wireProg.program;
    this.wireUniforms = wireProg.uniforms;

    this.partRenderer = new PartRenderer(gl, this.meshProgram, this.wireProgram);

    this.gl.enable(gl.BLEND);
    this.gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /**
   * Main draw call. Called once per rAF when the scene is dirty.
   *
   * @param {Object} project  - projectStore.project
   * @param {Object} editor   - editorStore state
   */
  draw(project, editor) {
    const { gl } = this;
    const { canvas } = gl;

    // Resize if needed
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.12, 0.12, 0.12, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!project || project.nodes.length === 0) return;

    const { zoom, panX, panY } = editor.view;
    const mvp = buildMVP(canvas.width, canvas.height, zoom, panX, panY);

    const overlays   = editor.overlays   ?? {};
    const selectionSet = new Set(editor.selection ?? []);

    // Sort parts by draw_order ascending
    const parts = project.nodes
      .filter(n => n.type === 'part')
      .sort((a, b) => a.draw_order - b.draw_order);

    // ── Textured mesh pass ────────────────────────────────────────────────────
    if (overlays.showImage !== false) {
      gl.useProgram(this.meshProgram);
      const uMvp     = this.meshUniforms('u_mvp');
      const uTexture = this.meshUniforms('u_texture');
      const uOpacity = this.meshUniforms('u_opacity');

      for (const part of parts) {
        if (part.visible === false) continue;
        this.partRenderer.drawPart(
          part.id,
          mvp,
          part.opacity ?? 1,
          uMvp, uTexture, uOpacity
        );
      }
    }

    // ── Overlay pass (wireframe / vertices / edge outline) ────────────────────
    // Conditions for drawing overlays:
    //   1. Global overlay toggle is on, OR
    //   2. Part is selected (always show overlays for selected parts)
    const needWirePass = overlays.showWireframe || overlays.showVertices ||
                         overlays.showEdgeOutline || selectionSet.size > 0;

    if (needWirePass) {
      gl.useProgram(this.wireProgram);
      const uMvpW  = this.wireUniforms('u_mvp');
      const uColor = this.wireUniforms('u_color');

      for (const part of parts) {
        if (part.visible === false) continue;
        const isSelected = selectionSet.has(part.id);

        // Edge outline — bright green boundary loop
        if (overlays.showEdgeOutline || isSelected) {
          gl.uniform4f(uColor, 0.2, 0.9, 0.1, isSelected ? 0.9 : 0.5);
          this.partRenderer.drawEdgeOutline(part.id, mvp, uMvpW);
        }

        // Wireframe triangles
        if (overlays.showWireframe || isSelected) {
          gl.uniform4f(uColor, 0.5, 0.8, 1.0, isSelected ? 0.3 : 0.15);
          this.partRenderer.drawWireframe(part.id, mvp, uMvpW, uColor);
        }

        // Vertices
        if (overlays.showVertices || isSelected) {
          this.partRenderer.drawVertices(part.id, mvp, uMvpW, uColor);
        }
      }
    }
  }

  /**
   * Pass-through to PartRenderer for external callers.
   */
  get parts() { return this.partRenderer; }

  destroy() {
    this.partRenderer.destroyAll();
    const { gl } = this;
    gl.deleteProgram(this.meshProgram);
    gl.deleteProgram(this.wireProgram);
  }
}
