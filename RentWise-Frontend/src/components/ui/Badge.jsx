import * as React from "react";
import { cn } from "../../lib/utils";





export function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-emerald-100/80 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-100/80 text-amber-800 border border-amber-200",
    danger: "bg-rose-100/80 text-rose-800 border border-rose-200",
    info: "bg-blue-100/80 text-blue-800 border border-blue-200",
    outline: "text-gray-800 border border-gray-300"
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props} />);


}