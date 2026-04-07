/**
 * ScenePass — orchestrates the full render pass.
 *
 * - Sorts parts by draw_order
 * - Builds MVP matrix from view (zoom/pan) + identity world transform (M3+)
 * - Issues draw calls via PartRenderer
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
  // Scale: pixels → NDC
  const sx = (2 * zoom) / canvasW;
  const sy = -(2 * zoom) / canvasH; // flip Y (WebGL Y is up)
  const tx = (panX / canvasW) * 2 - 1;
  const ty = 1 - (panY / canvasH) * 2;

  // Column-major mat3 (OpenGL convention):
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

    // Compile programs
    const meshProg = createProgram(gl, MESH_VERT, MESH_FRAG);
    const wireProg = createProgram(gl, WIRE_VERT, WIRE_FRAG);

    this.meshProgram = meshProg.program;
    this.meshUniforms = meshProg.uniforms;
    this.wireProgram = wireProg.program;
    this.wireUniforms = wireProg.uniforms;

    // Set attribute locations (must match shader layout)
    // We use explicit location binding via the VAO setup in PartRenderer

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

    // Sort parts by draw_order ascending
    const parts = project.nodes
      .filter(n => n.type === 'part')
      .sort((a, b) => a.draw_order - b.draw_order);

    // --- Textured mesh pass ---
    gl.useProgram(this.meshProgram);
    const uMvp     = this.meshUniforms('u_mvp');
    const uTexture = this.meshUniforms('u_texture');
    const uOpacity = this.meshUniforms('u_opacity');

    for (const part of parts) {
      this.partRenderer.drawPart(
        part.id,
        mvp,
        part.opacity ?? 1,
        uMvp, uTexture, uOpacity
      );
    }

    // --- Wireframe overlay for selected parts ---
    if (editor.selection.length > 0) {
      gl.useProgram(this.wireProgram);
      const uMvpW  = this.wireUniforms('u_mvp');
      const uColor = this.wireUniforms('u_color');

      for (const id of editor.selection) {
        // 1. Edges (Wireframe) - faint white/cyan
        gl.uniform4f(uColor, 0.5, 0.8, 1.0, 0.3);
        this.partRenderer.drawWireframe(id, mvp, uMvpW, uColor);

        // 2. Vertices (Density & Edge points)
        this.partRenderer.drawVertices(id, mvp, uMvpW, uColor);
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
