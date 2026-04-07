/**
 * Pure contour tracing and smoothing algorithms.
 * No DOM, no globals. Takes plain typed arrays / objects.
 */

// ─── Alpha buffer helper ──────────────────────────────────────────────────────

/**
 * @param {Uint8ClampedArray} data  - Raw RGBA pixel data
 * @param {number}            width
 * @param {number}            height
 * @param {number}            x
 * @param {number}            y
 * @param {number}            threshold
 */
function isInside(data, width, height, x, y, threshold) {
  x = Math.max(0, Math.min(width - 1, Math.round(x)));
  y = Math.max(0, Math.min(height - 1, Math.round(y)));
  return data[(y * width + x) * 4 + 3] >= threshold;
}

// ─── Moore-neighbour contour trace ────────────────────────────────────────────

/**
 * Trace the boundary contour of an image using the alpha channel.
 *
 * @param {Uint8ClampedArray} data            - RGBA pixel data
 * @param {number}            width
 * @param {number}            height
 * @param {number}            [alphaThreshold=20]
 * @returns {Array<[number,number]>}           Closed contour point list
 */
export function traceContour(data, width, height, alphaThreshold = 20) {
  let startX = -1, startY = -1;

  outerLoop: for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (
        isInside(data, width, height, x, y, alphaThreshold) &&
        !isInside(data, width, height, x - 1, y, alphaThreshold)
      ) {
        startX = x;
        startY = y;
        break outerLoop;
      }
    }
  }
  if (startX < 0) return [];

  // 8-directional neighbours: E, SE, S, SW, W, NW, N, NE
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const contour = [[startX, startY]];
  let curX = startX, curY = startY;
  let prevDir = 6; // start looking from W

  const maxSteps = width * height * 2;
  for (let steps = 0; steps < maxSteps; steps++) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const dir = (prevDir + 6 + i) % 8;
      const [dx, dy] = dirs[dir];
      const nx = curX + dx, ny = curY + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (isInside(data, width, height, nx, ny, alphaThreshold)) {
        prevDir = dir;
        curX = nx;
        curY = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (curX === startX && curY === startY) break;
    contour.push([curX, curY]);
  }

  return contour;
}

// ─── Arc-length resampling ────────────────────────────────────────────────────

/**
 * Resample a closed contour so points are uniformly spaced.
 *
 * @param {Array<[number,number]>} contour
 * @param {number}                 numPoints - Target sample count
 * @returns {Array<[number,number]>}
 */
export function resampleContour(contour, numPoints) {
  if (contour.length < 2) return contour;

  const arcLengths = [0];
  for (let i = 1; i < contour.length; i++) {
    const dx = contour[i][0] - contour[i - 1][0];
    const dy = contour[i][1] - contour[i - 1][1];
    arcLengths.push(arcLengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }

  const last = contour.length - 1;
  const dx0 = contour[0][0] - contour[last][0];
  const dy0 = contour[0][1] - contour[last][1];
  const totalLength = arcLengths[last] + Math.sqrt(dx0 * dx0 + dy0 * dy0);

  const result = [];
  const step = totalLength / numPoints;
  let seg = 0;

  for (let i = 0; i < numPoints; i++) {
    const targetLen = i * step;
    while (seg < arcLengths.length - 1 && arcLengths[seg + 1] < targetLen) seg++;

    const t = (seg < arcLengths.length - 1)
      ? Math.min(1, (targetLen - arcLengths[seg]) / (arcLengths[seg + 1] - arcLengths[seg]))
      : 0;

    const p0 = contour[seg];
    const p1 = contour[(seg + 1) % contour.length];
    result.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
  }

  return result;
}

// ─── Laplacian smoothing ─────────────────────────────────────────────────────

/**
 * Smooth contour using Laplacian (neighbour-average) relaxation.
 *
 * @param {Array<[number,number]>} points
 * @param {number}                 numPasses
 * @returns {Array<[number,number]>}
 */
export function smoothContour(points, numPasses = 3) {
  let result = points.slice();
  for (let p = 0; p < numPasses; p++) {
    result = result.map((pt, i) => {
      const prev = result[(i - 1 + result.length) % result.length];
      const next = result[(i + 1) % result.length];
      return [(prev[0] + pt[0] * 2 + next[0]) / 4, (prev[1] + pt[1] * 2 + next[1]) / 4];
    });
  }
  return result;
}
