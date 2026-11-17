"use client";

import { useEffect, useRef, useState } from "react";
import {
  analyzeImageData,
  applyTint,
  drawScaled,
  hexToRgb,
  type TintAnalysis,
} from "@/lib/garment-tint";
import { cn } from "@/lib/utils";

/**
 * Renders a product photo on a canvas and re-tints the garment fabric in
 * real time when `tint` (a CSS hex colour) changes, with a smooth colour
 * morph. Analysis results are cached per image URL and shared by every
 * instance (main view, thumbnails, cart).
 */

type Bundle = {
  analysis: TintAnalysis;
  srcData: Uint8ClampedArray;
  originalCanvas: HTMLCanvasElement;
};

const bundleCache = new Map<string, Promise<Bundle>>();

function loadBundle(src: string): Promise<Bundle> {
  const cached = bundleCache.get(src);
  if (cached) return cached;
  const promise = new Promise<Bundle>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = drawScaled(img);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("2D context unavailable");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const analysis = analyzeImageData(imageData.data, canvas.width, canvas.height);
        resolve({ analysis, srcData: imageData.data, originalCanvas: canvas });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("analysis failed"));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
  bundleCache.set(src, promise);
  promise.catch(() => bundleCache.delete(src));
  return promise;
}

export function TintableProductImage({
  src,
  alt,
  tint,
  className,
}: {
  src: string;
  alt: string;
  /** Target fabric colour (hex). Null/undefined renders the original photo. */
  tint?: string | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<ImageData | null>(null);
  const displayedRef = useRef<[number, number, number] | null>(null);
  const renderedBundleRef = useRef<Bundle | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState<{ src: string; bundle: Bundle } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const bundle = loaded?.src === src ? loaded.bundle : null;
  const failed = failedSrc === src;

  useEffect(() => {
    let cancelled = false;
    loadBundle(src)
      .then((b) => {
        if (!cancelled) setLoaded({ src, bundle: b });
      })
      .catch(() => {
        if (!cancelled) setFailedSrc(src);
      });
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (canvas.width !== bundle.analysis.w || canvas.height !== bundle.analysis.h) {
      canvas.width = bundle.analysis.w;
      canvas.height = bundle.analysis.h;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const { analysis, srcData, originalCanvas } = bundle;
    if (renderedBundleRef.current !== bundle) {
      // A different image just arrived — draw without morphing.
      displayedRef.current = null;
      renderedBundleRef.current = bundle;
    }
    if (!scratchRef.current || scratchRef.current.width !== analysis.w) {
      scratchRef.current = ctx.createImageData(analysis.w, analysis.h);
    }
    const scratch = scratchRef.current;

    const drawOriginal = () => {
      ctx.drawImage(originalCanvas, 0, 0);
    };
    const drawTint = (rgb: [number, number, number]) => {
      applyTint(srcData, scratch.data, analysis, rgb);
      ctx.putImageData(scratch, 0, 0);
    };

    const targetRgb = tint ? hexToRgb(tint) : null;
    if (!targetRgb) {
      displayedRef.current = null;
      drawOriginal();
      return;
    }

    const from = displayedRef.current;
    if (!from || (from[0] === targetRgb[0] && from[1] === targetRgb[1] && from[2] === targetRgb[2])) {
      displayedRef.current = targetRgb;
      drawTint(targetRgb);
      return;
    }

    const start = performance.now();
    const duration = 280;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const cur: [number, number, number] = [
        from[0] + (targetRgb[0] - from[0]) * e,
        from[1] + (targetRgb[1] - from[1]) * e,
        from[2] + (targetRgb[2] - from[2]) * e,
      ];
      displayedRef.current = cur;
      drawTint(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        displayedRef.current = targetRgb;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [bundle, tint]);

  if (failed) {
    return <img src={src} alt={alt} className={className} />;
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={cn("block h-full w-full object-cover", className)}
    />
  );
}
