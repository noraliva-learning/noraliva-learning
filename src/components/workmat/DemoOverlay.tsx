'use client';

import React, { useEffect, useState } from 'react';
import { Layer, Line, Rect } from 'react-konva';
import type { DemoOverlay as DemoOverlayConfig } from '@/lib/workmat/workmat-schema';

const DEMO_TRACE_COLOR = 'rgba(100, 100, 255, 0.6)';
const DEMO_HIGHLIGHT_FILL = 'rgba(255, 235, 59, 0.25)';

type Props = {
  overlays: DemoOverlayConfig[];
  width: number;
  height: number;
  targetZones?: { id: string; x: number; y: number; width: number; height: number }[];
  tracePaths?: { id: string; points: number[] }[];
  runIndex?: number;
};

/** Animated trace: draw path over time */
function AnimatedTracePath({
  points,
  durationMs = 2000,
  strokeWidth = 4,
}: {
  points: number[];
  durationMs?: number;
  strokeWidth?: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (points.length < 4) return;
    const start = Date.now();
    const totalLength = points.length / 2 - 1;
    const interval = 50;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p >= 1) clearInterval(id);
    }, interval);
    return () => clearInterval(id);
  }, [points.length, durationMs]);

  if (points.length < 4) return null;
  const numPoints = Math.max(2, Math.ceil((points.length / 2) * progress) * 2);
  const visiblePoints = points.slice(0, numPoints);

  return (
    <Line
      points={visiblePoints}
      stroke={DEMO_TRACE_COLOR}
      strokeWidth={strokeWidth}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  );
}

export function DemoOverlay({
  overlays,
  width,
  height,
  targetZones = [],
  tracePaths = [],
  runIndex = 0,
}: Props) {
  const [currentOverlayIndex, setCurrentOverlayIndex] = useState(0);
  const overlay = overlays[currentOverlayIndex];

  useEffect(() => {
    setCurrentOverlayIndex(runIndex % Math.max(1, overlays.length));
  }, [runIndex, overlays.length]);

  if (!overlay) return null;

  return (
    <Layer listening={false}>
      {overlay.type === 'trace_path' && overlay.trace_path_id && (() => {
        const path = tracePaths.find((p) => p.id === overlay.trace_path_id);
        if (!path) return null;
        return (
          <AnimatedTracePath
            points={path.points}
            durationMs={overlay.duration_ms ?? 2000}
          />
        );
      })()}
      {overlay.type === 'highlight_zone' && overlay.zone_id && (() => {
        const zone = targetZones.find((z) => z.id === overlay.zone_id);
        if (!zone) return null;
        return (
          <Rect
            x={zone.x}
            y={zone.y}
            width={zone.width}
            height={zone.height}
            fill={DEMO_HIGHLIGHT_FILL}
            stroke="rgba(255, 200, 0, 0.8)"
            strokeWidth={3}
          />
        );
      })()}
      {overlay.type === 'ghost_stroke' && overlay.points && overlay.points.length >= 4 && (
        <Line
          points={overlay.points}
          stroke="rgba(150, 150, 200, 0.5)"
          strokeWidth={6}
          lineCap="round"
          lineJoin="round"
          dash={[10, 5]}
        />
      )}
    </Layer>
  );
}
