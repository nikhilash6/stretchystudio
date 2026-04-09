export const BACKGROUND_VERT = `#version 300 es
precision highp float;

// Full-screen triangle trick
void main() {
  float x = -1.0 + float((gl_VertexID & 1) << 2);
  float y = -1.0 + float((gl_VertexID & 2) << 1);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

export const BACKGROUND_FRAG = `#version 300 es
precision highp float;

uniform vec2  u_resolution;
uniform float u_zoom;
uniform vec2  u_pan;
uniform float u_gridSize;
uniform bool  u_isDark;

out vec4 out_color;

void main() {
  // Convert screen pixels (gl_FragCoord) → project world space
  float worldX = (gl_FragCoord.x - u_pan.x) / u_zoom;
  float worldY = (u_resolution.y - gl_FragCoord.y - u_pan.y) / u_zoom;

  // Checkerboard logic
  vec2 grid = floor(vec2(worldX, worldY) / u_gridSize);
  float check = mod(grid.x + grid.y, 2.0);

  vec3 color1, color2;
  
  if (u_isDark) {
    // Dark mode colors (#1a1a1a and slightly lighter #222)
    color1 = vec3(0.102, 0.102, 0.102); 
    color2 = vec3(0.133, 0.133, 0.133); 
  } else {
    // Light mode colors (#f2f2f2 and #ffffff)
    color1 = vec3(0.95, 0.95, 0.95);
    color2 = vec3(1.0, 1.0, 1.0);
  }

  out_color = vec4(mix(color1, color2, check), 1.0);
}
`;
