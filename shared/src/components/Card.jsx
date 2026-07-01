import { cn } from "../lib/cn.js";

export function Card({ children, className }) {
  return (
    <section className={cn("rounded-lg border border-bybs-border bg-white p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}
