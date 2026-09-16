import * as React from "react";
import { cn } from "../../lib/utils";






export const Input = React.forwardRef(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label &&
        <label className="text-sm font-medium text-gray-700 mb-1 block">
            {label}
          </label>
        }
        <input
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20",
            className
          )}
          {...props} />
        
        {error &&
        <p className="text-sm text-rose-500 font-medium mt-1 animate-in slide-in-from-top-1">
            {error}
          </p>
        }
      </div>);

  }
);
Input.displayName = "Input";