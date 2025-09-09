// @ts-check
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ✅ Label UI universel
 * - Accessible (compatible screen readers)
 * - Stylé avec Tailwind
 * - Compatible with ShadCN / Radix UI
 * - Supporte `htmlFor` + `disabled` + custom class
 * - Optimisé pour les formulaires complexes (React Hook Form, etc.)
 */

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  tooltip?: string;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, tooltip, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1",
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-red-500">*</span>}
        {tooltip && (
          <span
            className="ml-1 text-xs text-muted-foreground"
            title={tooltip}
            aria-label={`Info: ${tooltip}`}
          >
            🛈
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = "Label";

export { Label };
