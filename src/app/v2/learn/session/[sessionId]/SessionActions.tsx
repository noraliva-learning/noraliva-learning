'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { endLearningSession } from '@/lib/db/endSession';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';

type Props = {
  sessionId: string;
  learnerSlug: string;
};

export function EndSessionButton({ sessionId, learnerSlug }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEndSession() {
    setLoading(true);
    try {
      await endLearningSession(sessionId);
      router.push(`/v2/learners/${learnerSlug}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <JoyfulButton
      onClick={handleEndSession}
      disabled={loading}
      variant="danger"
      className="rounded-xl px-6 py-3 text-lg"
    >
      {loading ? 'Ending…' : 'Done for now — back to my arcade'}
    </JoyfulButton>
  );
}
