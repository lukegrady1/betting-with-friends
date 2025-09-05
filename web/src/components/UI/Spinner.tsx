export default function Spinner() {
  return (
    <div className="grid place-items-center p-6" data-testid="spinner">
      <div className="h-10 w-10 animate-spinSmooth rounded-full bg-[conic-gradient(from_0deg,theme(colors.primary)_0%,theme(colors.accent)_40%,theme(colors.secondary)_70%,transparent_100%)] [mask:radial-gradient(farthest-side,transparent_62%,#000_63%)]" />
    </div>
  );
}

export function SpinnerInline({ size = "h-5 w-5" }: { size?: string }) {
  return (
    <div 
      className={`${size} animate-spinSmooth rounded-full bg-[conic-gradient(from_0deg,theme(colors.primary)_0%,theme(colors.accent)_40%,theme(colors.secondary)_70%,transparent_100%)] [mask:radial-gradient(farthest-side,transparent_62%,#000_63%)]`}
    />
  );
}