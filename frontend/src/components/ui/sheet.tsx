// 📦 Composant UI : sheet.tsx (Yukpo)
// ✅ Gère les panneaux latéraux (side sheets) avec prise en charge mobile

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Réexportation des éléments Radix
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

export interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  className?: string;
  children?: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = "right", ...props }, ref) => {
    const sideClass =
      side === "left"
        ? "left-0 border-r slide-in-from-left"
        : side === "top"
        ? "top-0 h-[50%] border-b slide-in-from-top"
        : side === "bottom"
        ? "bottom-0 h-[50%] border-t slide-in-from-bottom"
        : "right-0 border-l slide-in-from-right"; // default right

    return (
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(
            `fixed z-50 w-full max-w-sm bg-white shadow-lg h-full p-6 animate-in ${sideClass}`,
            className
          )}
          {...props}
        >
          {children}
          <SheetPrimitive.Close className="absolute top-4 right-4 text-gray-600 hover:text-black">
            <X className="h-5 w-5" />
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    );
  }
);

SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetClose, SheetContent };
