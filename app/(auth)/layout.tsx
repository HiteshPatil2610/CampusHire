export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--surface-0)' }}
      className="flex items-center justify-center"
    >
      {children}
    </div>
  );
}
