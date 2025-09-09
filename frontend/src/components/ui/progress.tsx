// @ts-check
import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentPropsWithoutRef<"div"> & {
  value?: number;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative h-3 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${value || 0}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
