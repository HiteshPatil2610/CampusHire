export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar will be added in future units */}
      <main className="flex-1 bg-[var(--surface-0)]">
        {children}
      </main>
    </div>
  );
}
