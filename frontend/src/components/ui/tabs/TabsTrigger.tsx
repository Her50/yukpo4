// @ts-check
import * as React from "react";
import { TabsTrigger as BaseTabsTrigger } from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof BaseTabsTrigger>,
  React.ComponentPropsWithoutRef<typeof BaseTabsTrigger>
>(({ className, ...props }, ref) => (
  <BaseTabsTrigger
    ref={ref}
    className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow", className)}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export default TabsTrigger;
