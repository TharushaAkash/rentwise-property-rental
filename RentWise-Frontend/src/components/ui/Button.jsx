import * as React from "react";
import { cn } from "../../lib/utils";







export const Button = React.forwardRef(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {

    const baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

    const variants = {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)]",
      secondary: "bg-white/70 backdrop-blur-md text-gray-800 border border-gray-200/50 hover:bg-white/90 shadow-sm focus:ring-gray-200",
      danger: "bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-500 shadow-[0_4px_14px_0_rgba(225,29,72,0.39)]",
      ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-200",
      outline: "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500"
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-8 text-base"
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}>
        
        {isLoading &&
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        }
        {children}
      </button>);

  }
);
Button.displayName = "Button";