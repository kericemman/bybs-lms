import { cn } from "../lib/cn.js";

export function Card({ children, className }) {
  return (
    <section className={cn("min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm sm:p-5", className)}>
      {children}
    </section>
  );
}
