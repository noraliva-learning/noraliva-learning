'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useState } from 'react';
import { WorkMatToolbar } from './WorkMatToolbar';
import type { SceneWorkmatConfig, WorkmatTool } from '@/lib/workmat/workmat-schema';
import type { WorkmatState } from './WorkMatCanvas';

const WorkMatCanvas = dynamic(
  () => import('./WorkMatCanvas').then((m) => ({ default: m.WorkMatCanvas })),
  { ssr: false }
);

type Props = {
  config: SceneWorkmatConfig;
  width?: number;
  height?: number;
  onStateChange?: (state: WorkmatState) => void;
  showDemoOverlay?: boolean;
  disabled?: boolean;
};

const defaultConfig: SceneWorkmatConfig = {
  workmat_enabled: true,
  workmat_mode: 'free_sketch',
  target_zones: [],
  trace_paths: [],
  draggable_objects: [],
  expected_marks: [],
  demo_overlays: [],
};

export function WorkMat({
  config = defaultConfig,
  width,
  height,
  onStateChange,
  showDemoOverlay = false,
  disabled = false,
}: Props) {
  const [currentTool, setCurrentTool] = useState<WorkmatTool>('pen');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [lastState, setLastState] = useState<WorkmatState | null>(null);

  const handleStateChange = useCallback(
    (state: WorkmatState) => {
      setLastState(state);
      onStateChange?.(state);
    },
    [onStateChange]
  );

  const handleClear = useCallback(() => {
    setClearTrigger((t) => t + 1);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <WorkMatToolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        onClear={handleClear}
        disabled={disabled}
      />
      <WorkMatCanvas
        config={config}
        width={width}
        height={height}
        currentTool={currentTool}
        clearTrigger={clearTrigger}
        onStateChange={handleStateChange}
        showDemoOverlay={showDemoOverlay}
      />
    </div>
  );
}

export type { WorkmatState } from './WorkMatCanvas';
