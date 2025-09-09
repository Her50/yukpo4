import * as React from "react"
import { cn } from "@/lib/utils"

export interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Popover: React.FC<PopoverProps> = ({ 
  open, 
  onOpenChange, 
  children 
}) => {
  return <>{children}</>
}

export interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ children, asChild }) => {
  if (asChild) {
    return <>{children}</>
  }
  return <div>{children}</div>
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 4, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "z-50 w-72 rounded-md border bg-white p-4 shadow-md",
          className
        )}
        style={{
          marginTop: `${sideOffset}px`
        }}
        {...props}
      />
    )
  }
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent } 