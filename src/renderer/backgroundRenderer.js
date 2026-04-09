import { createProgram } from './program.js';
import { BACKGROUND_VERT, BACKGROUND_FRAG } from './shaders/background.js';

export class BackgroundRenderer {
  constructor(gl) {
    this.gl = gl;
    const { program, uniforms } = createProgram(gl, BACKGROUND_VERT, BACKGROUND_FRAG);
    this.program = program;
    this.uniforms = uniforms;
    this.vao = gl.createVertexArray();
  }

  draw(zoom, panX, panY, canvasW, canvasH, isDark = true) {
    const { gl } = this;
    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms('u_resolution'), canvasW, canvasH);
    gl.uniform1f(this.uniforms('u_zoom'), zoom);
    gl.uniform2f(this.uniforms('u_pan'), panX, panY);
    gl.uniform1f(this.uniforms('u_gridSize'), 20.0);
    gl.uniform1i(this.uniforms('u_isDark'), isDark ? 1 : 0);

    gl.bindVertexArray(this.vao);
    // Draw one large triangle covering the screen (3 vertices)
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  destroy() {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
  }
}
