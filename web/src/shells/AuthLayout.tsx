export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 p-4">
      <div className="card soft w-full max-w-sm p-6">{children}</div>
    </div>
  );
}