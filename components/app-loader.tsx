import { cn } from "@/lib/utils";

type AppLoaderProps = {
  label?: string;
  className?: string;
};

export function AppLoader({ label = "読み込み中", className }: AppLoaderProps) {
  return (
    <div className={cn("app-loader", className)} aria-label={label} role="status">
      <span className="app-loader-bag" aria-hidden="true">
        <span />
      </span>
      <span className="app-loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FullScreenAppLoader({ label = "読み込み中" }: Pick<AppLoaderProps, "label">) {
  return (
    <div className="app-loading-screen" aria-busy="true" aria-live="polite">
      <AppLoader label={label} />
    </div>
  );
}
