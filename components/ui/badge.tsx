import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "completed" | "incomplete";

const variants: Record<BadgeVariant, string> = {
  default: "border-slate-200 bg-slate-100 text-slate-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  incomplete: "border-amber-200 bg-amber-50 text-amber-800",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
