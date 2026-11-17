/**
 * Garment tinting engine — recolors clothing fabric in product photos while
 * preserving backgrounds, prints, trims and mannequin parts.
 *
 * Pipeline (validated against the full product catalogue):
 *  1. Background model — border strips predict a smooth studio backdrop;
 *     pixels within tolerance are background (never tinted).
 *  2. Fabric base estimation — global median refined by averaging, plus a
 *     32x32 grid of local bases (outlier-rejected, neighbour-smoothed) that
 *     tracks lighting drift across the garment.
 *  3. Fabric classification — a pixel is fabric when it fits the "wedge"
 *     between the local base ray toward black (k in [0.12, 1.12]) and
 *     desaturation toward white (t in [0, 0.6]). Dark fits additionally
 *     pass a chroma-direction gate so deep shadows tint while dark prints
 *     stay untouched.
 *  4. Spatial coherence — the binary fabric map is median-filtered (box
 *     blur + threshold) and edge-feathered, killing speckles and washes.
 *  5. Tint — fabric luminance is remapped through the target colour with a
 *     target-relative shading softener, so navy->white stays clean while
 *     white->black keeps natural depth.
 */

export type TintAnalysis = {
  w: number;
  h: number;
  /** Per-pixel tint weight in [0, 1]; 0 for background. */
  weight: Float32Array;
  /** Per-pixel local base luminance (shading reference). */
  l0: Float32Array;
  /** Global base fabric luminance. */
  gL0: number;
};

const ANALYSIS_MAX = 720;
const BG_TOL = 34;
const REFINE_DIST = 55;
const GRID = 32;
const BLOCK_OUTLIER_DIST = 90;
const WEDGE_RESIDUAL_CUT = 36;
const T_STEPS = [0, 0.12, 0.24, 0.36, 0.48, 0.6];
const K_MIN = 0.12;
const K_MAX = 1.12;
const K_DARK_GATE = 0.45;
const CHROMA_ALIGN = 0.85;
const REL_MIN = 0;
const REL_MAX = 1.45;

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Draws an image onto a canvas capped at ANALYSIS_MAX on its long side. */
export function drawScaled(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, ANALYSIS_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

type BlockData = {
  /** Wedge candidate colours (t-scaled base), 6 x 3. */
  bt: Float64Array;
  /** Precomputed dot denominators per candidate. */
  btDenom: Float64Array;
  /** Base chroma vector (base - lum). */
  bc: Float64Array;
  bcMag: number;
  /** Base luminance for the L0 map. */
  lb: number;
};

export function analyzeImageData(
  data: Uint8ClampedArray,
  w: number,
  h: number
): TintAnalysis {
  const n = w * h;

  // ---- 1. border profiles (6px strips) ----
  const top = new Float64Array(w * 3);
  const bot = new Float64Array(w * 3);
  for (let x = 0; x < w; x++) {
    let a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let y = 0; y < 6; y++) {
      const i = (y * w + x) * 4;
      a0 += data[i]; a1 += data[i + 1]; a2 += data[i + 2];
      const j = ((h - 1 - y) * w + x) * 4;
      b0 += data[j]; b1 += data[j + 1]; b2 += data[j + 2];
    }
    top[x * 3] = a0 / 6; top[x * 3 + 1] = a1 / 6; top[x * 3 + 2] = a2 / 6;
    bot[x * 3] = b0 / 6; bot[x * 3 + 1] = b1 / 6; bot[x * 3 + 2] = b2 / 6;
  }
  const left = new Float64Array(h * 3);
  const right = new Float64Array(h * 3);
  for (let y = 0; y < h; y++) {
    let a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let x = 0; x < 6; x++) {
      const i = (y * w + x) * 4;
      a0 += data[i]; a1 += data[i + 1]; a2 += data[i + 2];
      const j = (y * w + (w - 1 - x)) * 4;
      b0 += data[j]; b1 += data[j + 1]; b2 += data[j + 2];
    }
    left[y * 3] = a0 / 6; left[y * 3 + 1] = a1 / 6; left[y * 3 + 2] = a2 / 6;
    right[y * 3] = b0 / 6; right[y * 3 + 1] = b1 / 6; right[y * 3 + 2] = b2 / 6;
  }

  const w1 = w - 1;
  const h1 = h - 1;
  const isBg = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const fy = y / h1;
    const ly = y * 3;
    for (let x = 0; x < w; x++) {
      const fx = x / w1;
      const tx = x * 3;
      const tb0 = top[tx] * (1 - fy) + bot[tx] * fy;
      const tb1 = top[tx + 1] * (1 - fy) + bot[tx + 1] * fy;
      const tb2 = top[tx + 2] * (1 - fy) + bot[tx + 2] * fy;
      const lr0 = left[ly] * (1 - fx) + right[ly] * fx;
      const lr1 = left[ly + 1] * (1 - fx) + right[ly + 1] * fx;
      const lr2 = left[ly + 2] * (1 - fx) + right[ly + 2] * fx;
      const q0 = (tb0 + lr0) * 0.5;
      const q1 = (tb1 + lr1) * 0.5;
      const q2 = (tb2 + lr2) * 0.5;
      const i = (y * w + x) * 4;
      const dr = data[i] - q0;
      const dg = data[i + 1] - q1;
      const db = data[i + 2] - q2;
      if (dr * dr + dg * dg + db * db < BG_TOL * BG_TOL) {
        isBg[y * w + x] = 1;
      }
    }
  }

  // ---- 2. global fabric base (median of garment pixels, refined) ----
  const garmentIdx: number[] = [];
  for (let i = 0; i < n; i++) if (!isBg[i]) garmentIdx.push(i);
  const chR = new Float64Array(garmentIdx.length);
  const chG = new Float64Array(garmentIdx.length);
  const chB = new Float64Array(garmentIdx.length);
  for (let k = 0; k < garmentIdx.length; k++) {
    const p = garmentIdx[k] * 4;
    chR[k] = data[p];
    chG[k] = data[p + 1];
    chB[k] = data[p + 2];
  }
  chR.sort(); chG.sort(); chB.sort();
  const mid = garmentIdx.length >> 1;
  let g0 = chR[mid] || 128;
  let g1 = chG[mid] || 128;
  let g2 = chB[mid] || 128;
  for (let pass = 0; pass < 2; pass++) {
    let a0 = 0, a1 = 0, a2 = 0, cnt = 0;
    for (let k = 0; k < garmentIdx.length; k++) {
      const p = garmentIdx[k] * 4;
      const dr = data[p] - g0, dg = data[p + 1] - g1, db = data[p + 2] - g2;
      if (dr * dr + dg * dg + db * db < REFINE_DIST * REFINE_DIST) {
        a0 += data[p]; a1 += data[p + 1]; a2 += data[p + 2];
        cnt++;
      }
    }
    if (cnt > 0) {
      g0 = a0 / cnt; g1 = a1 / cnt; g2 = a2 / cnt;
    }
  }
  const gL0 = Math.max(1, luminance(g0, g1, g2));

  // ---- local block bases ----
  const bw = w / GRID;
  const bh = h / GRID;
  const blocks: (Float64Array | null)[] = new Array(GRID * GRID).fill(null);
  const tmpR: number[] = [];
  const tmpG: number[] = [];
  const tmpB: number[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = Math.floor(gx * bw);
      const x1 = Math.min(w, Math.floor((gx + 1) * bw));
      const y0 = Math.floor(gy * bh);
      const y1 = Math.min(h, Math.floor((gy + 1) * bh));
      tmpR.length = 0; tmpG.length = 0; tmpB.length = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = y * w + x;
          if (isBg[i]) continue;
          const p = i * 4;
          tmpR.push(data[p]); tmpG.push(data[p + 1]); tmpB.push(data[p + 2]);
        }
      }
      if (tmpR.length === 0) continue;
      tmpR.sort((a, b) => a - b);
      tmpG.sort((a, b) => a - b);
      tmpB.sort((a, b) => a - b);
      const m = tmpR.length >> 1;
      const med = new Float64Array([tmpR[m], tmpG[m], tmpB[m]]);
      const dr = med[0] - g0, dg = med[1] - g1, db = med[2] - g2;
      blocks[gy * GRID + gx] =
        dr * dr + dg * dg + db * db > BLOCK_OUTLIER_DIST * BLOCK_OUTLIER_DIST
          ? null
          : med;
    }
  }
  // fill fallbacks from accepted neighbours
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const idx = gy * GRID + gx;
        if (blocks[idx]) continue;
        let a0 = 0, a1 = 0, a2 = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = gy + dy, nx = gx + dx;
            if (ny < 0 || ny >= GRID || nx < 0 || nx >= GRID) continue;
            const b = blocks[ny * GRID + nx];
            if (b) {
              a0 += b[0]; a1 += b[1]; a2 += b[2];
              cnt++;
            }
          }
        }
        if (cnt > 0) {
          blocks[idx] = new Float64Array([a0 / cnt, a1 / cnt, a2 / cnt]);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i]) blocks[i] = new Float64Array([g0, g1, g2]);
  }
  // smooth block bases (3x3)
  const smoothed: Float64Array[] = new Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let a0 = 0, a1 = 0, a2 = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = gy + dy, nx = gx + dx;
          if (ny < 0 || ny >= GRID || nx < 0 || nx >= GRID) continue;
          const b = blocks[ny * GRID + nx]!;
          a0 += b[0]; a1 += b[1]; a2 += b[2];
          cnt++;
        }
      }
      smoothed[gy * GRID + gx] = new Float64Array([a0 / cnt, a1 / cnt, a2 / cnt]);
    }
  }

  // ---- precompute per-block wedge tables ----
  const blockData: BlockData[] = new Array(GRID * GRID);
  const blockLb = new Float64Array(GRID * GRID);
  for (let i = 0; i < smoothed.length; i++) {
    const b = smoothed[i]!;
    const lb = Math.max(1, luminance(b[0], b[1], b[2]));
    blockLb[i] = lb;
    const bt = new Float64Array(T_STEPS.length * 3);
    const btDenom = new Float64Array(T_STEPS.length);
    for (let c = 0; c < T_STEPS.length; c++) {
      const t = T_STEPS[c];
      const b0 = b[0] + t * (255 - b[0]);
      const b1 = b[1] + t * (255 - b[1]);
      const b2 = b[2] + t * (255 - b[2]);
      bt[c * 3] = b0; bt[c * 3 + 1] = b1; bt[c * 3 + 2] = b2;
      btDenom[c] = b0 * b0 + b1 * b1 + b2 * b2;
    }
    const bc0 = b[0] - lb, bc1 = b[1] - lb, bc2 = b[2] - lb;
    blockData[i] = {
      bt,
      btDenom,
      bc: new Float64Array([bc0, bc1, bc2]),
      bcMag: Math.sqrt(bc0 * bc0 + bc1 * bc1 + bc2 * bc2),
      lb,
    };
  }

  // ---- 3. binary fabric classification ----
  const fabric = new Uint8Array(n);
  const l0 = new Float32Array(n);
  const invBw = 1 / bw;
  const invBh = 1 / bh;
  for (let y = 0; y < h; y++) {
    const gy = clamp(Math.floor(y * invBh), 0, GRID - 1);
    // bilinear L0 across block centres
    const fy = clamp(y * invBh - 0.5, 0, GRID - 1.001);
    const by0 = Math.floor(fy);
    const ty = fy - by0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (isBg[i]) continue;
      const fx = clamp(x * invBw - 0.5, 0, GRID - 1.001);
      const bx0 = Math.floor(fx);
      const tx = fx - bx0;
      const l00 = blockLb[by0 * GRID + bx0];
      const l10 = blockLb[by0 * GRID + bx0 + 1];
      const l01 = blockLb[(by0 + 1) * GRID + bx0];
      const l11 = blockLb[(by0 + 1) * GRID + bx0 + 1];
      l0[i] =
        (l00 * (1 - tx) + l10 * tx) * (1 - ty) + (l01 * (1 - tx) + l11 * tx) * ty;

      const gx = clamp(Math.floor(x * invBw), 0, GRID - 1);
      const bd = blockData[gy * GRID + gx]!;
      const p = i * 4;
      const p0 = data[p], p1 = data[p + 1], p2 = data[p + 2];
      let best = Infinity;
      let bestK = Infinity;
      for (let c = 0; c < T_STEPS.length; c++) {
        const denom = bd.btDenom[c];
        if (denom < 1e-6) continue;
        const b0 = bd.bt[c * 3], b1 = bd.bt[c * 3 + 1], b2 = bd.bt[c * 3 + 2];
        const k = (p0 * b0 + p1 * b1 + p2 * b2) / denom;
        if (k < K_MIN || k > K_MAX) continue;
        const dr = p0 - k * b0, dg = p1 - k * b1, db = p2 - k * b2;
        const res = Math.sqrt(dr * dr + dg * dg + db * db);
        if (res < best) {
          best = res;
          bestK = k;
        }
      }
      if (best >= WEDGE_RESIDUAL_CUT) continue;
      if (bestK < K_DARK_GATE && bd.bcMag > 12) {
        const lp = luminance(p0, p1, p2);
        const pc0 = p0 - lp, pc1 = p1 - lp, pc2 = p2 - lp;
        const pcMag = Math.sqrt(pc0 * pc0 + pc1 * pc1 + pc2 * pc2);
        if (pcMag < 8) continue;
        const dot = pc0 * bd.bc[0] + pc1 * bd.bc[1] + pc2 * bd.bc[2];
        if (dot / (pcMag * bd.bcMag + 1e-9) < CHROMA_ALIGN) continue;
      }
      fabric[i] = 1;
    }
  }

  // ---- 4. spatial coherence: box blur x2 -> threshold -> feather ----
  const blur = (src: Float32Array): Float32Array => {
    const dst = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let acc = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            acc += src[ny * w + nx];
            cnt++;
          }
        }
        dst[y * w + x] = acc / cnt;
      }
    }
    return dst;
  };
  const binF = new Float32Array(n);
  for (let i = 0; i < n; i++) binF[i] = fabric[i];
  const b1 = blur(binF);
  const b1b = new Float32Array(n);
  for (let i = 0; i < n; i++) b1b[i] = b1[i] > 0.5 ? 1 : 0;
  const b2 = blur(b1b);

  const weight = new Float32Array(n);
  const featherSrc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (isBg[i]) {
      weight[i] = 0;
    } else {
      weight[i] = b2[i] > 0.45 ? 1 : 0;
      featherSrc[i] = weight[i];
    }
  }
  const feather = blur(featherSrc);
  for (let i = 0; i < n; i++) {
    if (isBg[i]) continue;
    const f = feather[i];
    if (f > 0.05 && f < 0.95) weight[i] = f;
  }

  return { w, h, weight, l0, gL0 };
}

/**
 * Applies a tint to source pixels, writing into `out`.
 * `out` may be the same buffer as `src`.
 */
export function applyTint(
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  a: TintAnalysis,
  target: [number, number, number]
): void {
  const [tr, tg, tb] = target;
  const lt = luminance(tr, tg, tb);
  const ratio = lt / a.gL0;
  const s = clamp(0.85 - 0.25 * Math.log2(Math.max(ratio, 1e-3)), 0.35, 0.95);
  const { weight, l0 } = a;
  const n = a.w * a.h;
  for (let i = 0; i < n; i++) {
    const wgt = weight[i];
    const p = i * 4;
    if (wgt <= 0.001) {
      if (out !== src) {
        out[p] = src[p];
        out[p + 1] = src[p + 1];
        out[p + 2] = src[p + 2];
        out[p + 3] = src[p + 3];
      }
      continue;
    }
    const r0 = src[p], g0 = src[p + 1], b0 = src[p + 2];
    const L = luminance(r0, g0, b0);
    const rel = clamp(1 + (L / l0[i] - 1) * s, REL_MIN, REL_MAX);
    out[p] = r0 + (Math.min(255, tr * rel) - r0) * wgt;
    out[p + 1] = g0 + (Math.min(255, tg * rel) - g0) * wgt;
    out[p + 2] = b0 + (Math.min(255, tb * rel) - b0) * wgt;
    out[p + 3] = src[p + 3];
  }
}
