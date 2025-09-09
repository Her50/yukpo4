// @ts-check
import * as React from "react";
import { TabsContent as BaseTabsContent, TabsContentProps } from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// Typage explicite des props et du ref
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, ...props }, ref) => (
    <BaseTabsContent
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
);

TabsContent.displayName = "TabsContent";

export default TabsContent;
