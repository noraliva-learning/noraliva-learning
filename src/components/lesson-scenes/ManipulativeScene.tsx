'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';
import { WorkMat } from '@/components/workmat';
import type { WorkmatState } from '@/components/workmat';
import type { SceneWorkmatConfig } from '@/lib/workmat/workmat-schema';
import type { WorkmatValidationResult } from '@/lib/workmat/workmat-schema';
import { runValidation } from '@/lib/workmat/workmat-validation';

type SceneObject = { id: string; type?: string; label?: string; value?: number | string };

type Props = {
  displayText: string;
  voiceoverText?: string;
  objects?: SceneObject[];
  workmat?: SceneWorkmatConfig;
  onContinue: () => void;
  onWorkmatStateChange?: (state: WorkmatState) => void;
  onWorkmatValidationResult?: (result: WorkmatValidationResult) => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

export function ManipulativeScene({
  displayText,
  voiceoverText,
  objects = [],
  workmat,
  onContinue,
  onWorkmatStateChange,
  onWorkmatValidationResult,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const textToSpeak = voiceoverText || displayText;
  const workmatStateRef = useRef<WorkmatState | null>(null);
  const showDemoOverlay = (workmat?.demo_overlays?.length ?? 0) > 0;

  const handleWorkmatStateChange = useCallback(
    (state: WorkmatState) => {
      workmatStateRef.current = state;
      onWorkmatStateChange?.(state);
    },
    [onWorkmatStateChange]
  );

  const handleContinue = useCallback(() => {
    if (workmat?.workmat_enabled && workmat.validation_type && workmatStateRef.current) {
      const result = runValidation(workmat, workmatStateRef.current);
      onWorkmatValidationResult?.(result);
    }
    onContinue();
  }, [workmat, onWorkmatValidationResult, onContinue]);

  useEffect(() => {
    if (!textToSpeak?.trim() || !autoPlayNarration) return;
    const t = setTimeout(() => speakNarration(textToSpeak, { rate: 0.88 }), 400);
    return () => {
      clearTimeout(t);
      stopNarration();
    };
  }, [textToSpeak, autoPlayNarration]);

  return (
    <motion.div
      className="rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6 shadow-sm"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 text-lg font-medium text-[rgb(var(--learner-text))]">{displayText}</p>
        <AudioReplayButton text={textToSpeak} aria-label="Replay" onReplay={onNarrationReplay} />
      </div>
      {workmat?.workmat_enabled ? (
        <div className="mt-4">
          <WorkMat
            config={{
              workmat_enabled: true,
              workmat_mode: workmat.workmat_mode ?? 'free_sketch',
              workmat_modality: workmat.workmat_modality,
              background_asset: workmat.background_asset,
              target_zones: workmat.target_zones ?? [],
              trace_paths: workmat.trace_paths ?? [],
              draggable_objects: workmat.draggable_objects ?? [],
              expected_marks: workmat.expected_marks ?? [],
              validation_type: workmat.validation_type,
              demo_overlays: workmat.demo_overlays ?? [],
            }}
            onStateChange={handleWorkmatStateChange}
            showDemoOverlay={showDemoOverlay}
          />
        </div>
      ) : null}
      {objects.length > 0 && !workmat?.workmat_enabled && (
        <motion.div
          className="mt-6 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {objects.map((obj, i) => (
            <motion.div
              key={obj.id}
              className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-surface))] text-xl font-bold text-[rgb(var(--learner-text))]"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 * i, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {obj.label ?? obj.value ?? '?'}
            </motion.div>
          ))}
        </motion.div>
      )}
      <div className="mt-6 flex justify-end">
        <JoyfulButton onClick={handleContinue} variant="primary">
          Next →
        </JoyfulButton>
      </div>
    </motion.div>
  );
}
