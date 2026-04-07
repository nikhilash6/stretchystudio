/**
 * Mesh generation orchestrator.
 *
 * image → {vertices, uvs, triangles, edgeIndices}
 *
 * This is a pure module — no DOM, no classes.
 * Designed to run both on the main thread and inside a Web Worker.
 */
import { traceContour, resampleContour, smoothContour } from './contour.js';
import { sampleInterior, filterByEdgePadding } from './sample.js';
import { triangulate } from './delaunay.js';

/**
 * @typedef {Object} MeshResult
 * @property {Array<{x:number,y:number,restX:number,restY:number}>} vertices
 * @property {Float32Array}                                           uvs        - flat [u0,v0, u1,v1, …] in [0,1]
 * @property {Array<[number,number,number]>}                          triangles
 * @property {Set<number>}                                            edgeIndices - which vertex indices are on the boundary
 */

/**
 * Generate mesh from raw RGBA image data.
 *
 * @param {Uint8ClampedArray} data            - RGBA pixel data
 * @param {number}            width
 * @param {number}            height
 * @param {Object}            [opts]
 * @param {number}            [opts.alphaThreshold=20]
 * @param {number}            [opts.smoothPasses=3]
 * @param {number}            [opts.gridSpacing=30]
 * @param {number}            [opts.edgePadding=8]
 * @param {number}            [opts.numEdgePoints=80]
 * @returns {MeshResult}
 */
export function generateMesh(data, width, height, opts = {}) {
  const {
    alphaThreshold = 20,
    smoothPasses   = 3,
    gridSpacing    = 30,
    edgePadding    = 8,
    numEdgePoints  = 80,
  } = opts;

  // 1. Contour
  const rawContour = traceContour(data, width, height, alphaThreshold);
  let edgePts = resampleContour(rawContour, Math.min(numEdgePoints, Math.max(3, rawContour.length)));
  edgePts = smoothContour(edgePts, smoothPasses);

  // 2. Interior
  let interiorPts = sampleInterior(data, width, height, alphaThreshold, Math.max(6, gridSpacing));
  if (edgePadding > 0) {
    interiorPts = filterByEdgePadding(interiorPts, edgePts, edgePadding);
  }

  // 3. Combine & deduplicate
  const allPts = [...edgePts, ...interiorPts];
  const rawEdgeCount = edgePts.length;
  const deduped = [];
  const edgeSet = new Set();
  const MIN_DIST2 = 4;

  for (let i = 0; i < allPts.length; i++) {
    const [px, py] = allPts[i];
    let dup = false;
    for (const [dx, dy] of deduped) {
      const ex = px - dx, ey = py - dy;
      if (ex * ex + ey * ey < MIN_DIST2) { dup = true; break; }
    }
    if (!dup) {
      if (i < rawEdgeCount) edgeSet.add(deduped.length);
      deduped.push([px, py]);
    }
  }

  // 4. Triangulate
  const triangles = triangulate(deduped);

  // 5. Build output arrays
  const vertices = deduped.map(([x, y]) => ({
    x, y,
    restX: x,
    restY: y,
  }));

  // UVs: normalize to [0,1] based on image dimensions
  const uvs = new Float32Array(deduped.length * 2);
  for (let i = 0; i < deduped.length; i++) {
    uvs[i * 2]     = deduped[i][0] / width;
    uvs[i * 2 + 1] = deduped[i][1] / height;
  }

  return { vertices, uvs, triangles, edgeIndices: edgeSet };
}
