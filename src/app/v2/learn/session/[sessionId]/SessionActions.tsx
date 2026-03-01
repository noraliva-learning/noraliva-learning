'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { endLearningSession } from '@/lib/db/endSession';

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
    <button
      onClick={handleEndSession}
      disabled={loading}
      className="rounded-xl bg-rose-600 px-6 py-3 text-lg font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
    >
      {loading ? 'Ending…' : 'End Session'}
    </button>
  );
}
