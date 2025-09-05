export function SkeletonCard() {
  return (
    <div className="card soft h-24 animate-shimmer bg-[linear-gradient(90deg,theme(colors.muted.DEFAULT)_25%,theme(colors.muted.DEFAULT)/60_37%,theme(colors.muted.DEFAULT)_63%)] bg-[length:200%_100%] rounded-2xl" />
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 animate-shimmer bg-[linear-gradient(90deg,theme(colors.muted.DEFAULT)_25%,theme(colors.muted.DEFAULT)/60_37%,theme(colors.muted.DEFAULT)_63%)] bg-[length:200%_100%] rounded ${className}`} />
  );
}

export function SkeletonCircle({ size = "h-10 w-10" }: { size?: string }) {
  return (
    <div className={`${size} animate-shimmer bg-[linear-gradient(90deg,theme(colors.muted.DEFAULT)_25%,theme(colors.muted.DEFAULT)/60_37%,theme(colors.muted.DEFAULT)_63%)] bg-[length:200%_100%] rounded-full`} />
  );
}