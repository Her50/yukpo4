// @ts-check
import * as React from "react";
import { Tabs as BaseTabs } from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<
  React.ElementRef<typeof BaseTabs>,
  React.ComponentPropsWithoutRef<typeof BaseTabs>
>(({ className, ...props }, ref) => (
  <BaseTabs ref={ref} className={cn("w-full", className)} {...props} />
));
Tabs.displayName = "Tabs";

export default Tabs;
