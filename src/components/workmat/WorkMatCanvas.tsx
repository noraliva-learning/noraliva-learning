'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Circle as KonvaCircle } from 'react-konva';
import type Konva from 'konva';
import { DemoOverlay } from './DemoOverlay';
import type {
  SceneWorkmatConfig,
  Stroke,
  PlacedObject,
  Connection,
  WorkmatTool,
} from '@/lib/workmat/workmat-schema';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PEN_COLOR = '#1a1a2e';
const HIGHLIGHTER_COLOR = 'rgba(255, 235, 59, 0.5)';
const ZONE_STROKE = 'rgba(100, 100, 200, 0.6)';
const TRACE_GUIDE_STROKE = 'rgba(180, 180, 180, 0.8)';

export type WorkmatState = { strokes: Stroke[]; placed_objects: PlacedObject[]; connections: Connection[] };

type Props = {
  config: SceneWorkmatConfig;
  width?: number;
  height?: number;
  currentTool: WorkmatTool;
  clearTrigger?: number;
  onStateChange?: (state: WorkmatState) => void;
  showDemoOverlay?: boolean;
};

export function WorkMatCanvas({
  config,
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
  currentTool,
  clearTrigger = 0,
  onStateChange,
  showDemoOverlay = false,
}: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>(
    (config.draggable_objects ?? []).map((o) => ({ id: o.id, x: o.x, y: o.y }))
  );
  const [connections, setConnections] = useState<Connection[]>([]);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [circleStart, setCircleStart] = useState<{ x: number; y: number } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const lastClearTrigger = useRef(clearTrigger);

  if (clearTrigger !== lastClearTrigger.current) {
    lastClearTrigger.current = clearTrigger;
    setStrokes([]);
    setConnections([]);
    setPlacedObjects((config.draggable_objects ?? []).map((o) => ({ id: o.id, x: o.x, y: o.y })));
    setCurrentPoints([]);
    setLineStart(null);
    setCircleStart(null);
  }

  const effectiveTool =
    currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser'
      ? currentTool
      : currentTool === 'pointer'
        ? 'pointer'
        : currentTool === 'line'
          ? 'line'
          : currentTool === 'circle'
            ? 'circle'
            : 'pen';
  useEffect(() => {
    onStateChange?.({
      strokes: [...strokes],
      placed_objects: [...placedObjects],
      connections: [...connections],
    });
  }, [strokes, placedObjects, connections, onStateChange]);

  const getStrokeConfig = useCallback(() => {
    const isEraser = effectiveTool === 'eraser';
    return {
      stroke: isEraser ? 'rgba(0,0,0,0.5)' : effectiveTool === 'highlighter' ? HIGHLIGHTER_COLOR : PEN_COLOR,
      strokeWidth: effectiveTool === 'highlighter' ? 24 : effectiveTool === 'eraser' ? 20 : 3,
      globalCompositeOperation: (isEraser ? ('destination-out' as const) : ('source-over' as const)),
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      opacity: effectiveTool === 'highlighter' ? 0.7 : 1,
    };
  }, [effectiveTool]);

  const handlePointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const x = pos.x;
      const y = pos.y;

      if (effectiveTool === 'line') {
        setLineStart({ x, y });
        setCurrentPoints([x, y]);
        setIsDrawing(true);
        return;
      }
      if (effectiveTool === 'circle') {
        setCircleStart({ x, y });
        setCurrentPoints([x, y]);
        setIsDrawing(true);
        return;
      }
      if (effectiveTool === 'pointer') return;

      setCurrentPoints([x, y]);
      setIsDrawing(true);
    },
    [effectiveTool]
  );

  const handlePointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isDrawing) return;
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const x = pos.x;
      const y = pos.y;

      if (effectiveTool === 'line' && lineStart) {
        setCurrentPoints([lineStart.x, lineStart.y, x, y]);
        return;
      }
      if (effectiveTool === 'circle' && circleStart) {
        const r = Math.hypot(x - circleStart.x, y - circleStart.y);
        setCurrentPoints([circleStart.x, circleStart.y, r]);
        return;
      }

      setCurrentPoints((prev) => [...prev, x, y]);
    },
    [isDrawing, effectiveTool, lineStart, circleStart]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;

    if (effectiveTool === 'line' && lineStart && currentPoints.length >= 4) {
      setConnections((prev) => [
        ...prev,
        { fromId: 'line', toId: 'line', points: currentPoints },
      ]);
      setLineStart(null);
    }
    if (effectiveTool === 'circle' && circleStart && currentPoints.length >= 3) {
      const r = currentPoints[2] ?? 10;
      setStrokes((prev) => [
        ...prev,
        {
          tool: 'circle',
          points: [circleStart.x, circleStart.y, r],
          strokeWidth: 2,
          color: PEN_COLOR,
        },
      ]);
      setCircleStart(null);
    }
    if (effectiveTool === 'pen' || effectiveTool === 'highlighter' || effectiveTool === 'eraser') {
      if (currentPoints.length >= 4) {
        const cfg = getStrokeConfig();
        setStrokes((prev) => [
          ...prev,
          {
            tool: effectiveTool,
            points: [...currentPoints],
            strokeWidth: cfg.strokeWidth,
            color: cfg.stroke,
            opacity: cfg.opacity,
          },
        ]);
      }
    }

    setCurrentPoints([]);
    setIsDrawing(false);
  }, [
    isDrawing,
    effectiveTool,
    currentPoints,
    lineStart,
    circleStart,
    getStrokeConfig,
  ]);

  const zones = config.target_zones ?? [];
  const tracePaths = config.trace_paths ?? [];
  const draggables = config.draggable_objects ?? [];
  const isStructured = config.workmat_mode === 'structured_worksheet';

  return (
    <div className="workmat-canvas-container">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none', borderRadius: 12, border: '2px solid rgb(var(--learner-border))' }}
      >
        {/* Background / worksheet layer */}
        <Layer>
          <Rect x={0} y={0} width={width} height={height} fill="#fefce8" listening={false} />
        </Layer>

        {/* Target zones (structured mode) */}
        {isStructured && zones.length > 0 && (
          <Layer listening={false}>
            {zones.map((z) => (
              <Rect
                key={z.id}
                x={z.x}
                y={z.y}
                width={z.width}
                height={z.height}
                stroke={ZONE_STROKE}
                strokeWidth={2}
                dash={[4, 4]}
                fill="rgba(200, 220, 255, 0.2)"
              />
            ))}
          </Layer>
        )}

        {/* Trace guides */}
        {isStructured && tracePaths.length > 0 && (
          <Layer listening={false}>
            {tracePaths.map((t) => (
              <Line
                key={t.id}
                points={t.points}
                stroke={TRACE_GUIDE_STROKE}
                strokeWidth={t.stroke_width ?? 2}
                dash={t.dashed ? [8, 4] : undefined}
                lineCap="round"
                lineJoin="round"
              />
            ))}
          </Layer>
        )}

        {/* Draggable objects (simplified: display only; drag could be added) */}
        {draggables.length > 0 && (
          <Layer>
            {draggables.map((d) => {
              const placed = placedObjects.find((p) => p.id === d.id) ?? { id: d.id, x: d.x, y: d.y };
              const w = d.width ?? 40;
              const h = d.height ?? 40;
              const cx = placed.x + w / 2;
              const cy = placed.y + h / 2;
              const r = Math.min(w, h) / 2;
              return (
                <KonvaCircle
                  key={d.id}
                  x={cx}
                  y={cy}
                  radius={r}
                  fill="rgba(100, 150, 255, 0.4)"
                  stroke="#334155"
                  strokeWidth={2}
                  draggable
                  onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                    const node = e.target;
                    setPlacedObjects((prev) =>
                      prev.map((p) =>
                        p.id === d.id
                          ? { id: p.id, x: node.x() - w / 2, y: node.y() - h / 2 }
                          : p
                      )
                    );
                  }}
                />
              );
            })}
          </Layer>
        )}

        {/* User strokes */}
        <Layer>
          {strokes.map((s, i) => {
            if (s.tool === 'circle' && s.points.length >= 3) {
              return (
                <KonvaCircle
                  key={i}
                  x={s.points[0]}
                  y={s.points[1]}
                  radius={s.points[2]}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                  opacity={s.opacity ?? 1}
                />
              );
            }
            return (
              <Line
                key={i}
                points={s.points}
                stroke={s.color}
                strokeWidth={s.strokeWidth}
                opacity={s.opacity ?? 1}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={s.tool === 'eraser' ? ('destination-out' as const) : ('source-over' as const)}
              />
            );
          })}
          {currentPoints.length >= 2 && (
            <Line
              points={currentPoints}
              {...getStrokeConfig()}
            />
          )}
          {effectiveTool === 'circle' && circleStart && currentPoints.length >= 3 && (
            <KonvaCircle
              x={circleStart.x}
              y={circleStart.y}
              radius={currentPoints[2] ?? 0}
              stroke={PEN_COLOR}
              strokeWidth={2}
              dash={[4, 4]}
            />
          )}
        </Layer>

        {showDemoOverlay && (config.demo_overlays?.length ?? 0) > 0 && (
          <DemoOverlay
            overlays={config.demo_overlays ?? []}
            width={width}
            height={height}
            targetZones={config.target_zones}
            tracePaths={config.trace_paths}
          />
        )}
      </Stage>
    </div>
  );
}

