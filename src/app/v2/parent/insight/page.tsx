import { getParentViewData } from '@/lib/db/getParentViewData';
import { ParentInsightView } from './ParentInsightView';

export default async function ParentInsightPage() {
  const progress = await getParentViewData();
  const children = progress.map((p) => ({ id: p.id, display_name: p.display_name, role: p.role }));

  if (children.length === 0) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-slate-600">No learners linked to your account.</p>
        <a href="/v2/parent" className="mt-4 inline-block text-slate-700 underline">
          Back to parent dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <ParentInsightView>{children}</ParentInsightView>
    </main>
  );
}
