import NotFoundContent from '@/components/shared/not-found-content';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--surface-0)' }}
      className="flex items-center justify-center"
    >
      <NotFoundContent />
    </div>
  );
}
