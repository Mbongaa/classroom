import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#000000] text-white border border-transparent hover:bg-[#1a1a1a] focus:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549] focus-visible:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549] focus-visible:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549]",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground focus:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549] focus-visible:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549]",
        secondary:
          "bg-[#000000] text-white/70 border border-transparent hover:bg-[#1a1a1a] hover:text-white focus:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549] focus-visible:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glow: "bg-[#000000] text-white border border-transparent hover:bg-[#1a1a1a] focus:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549] focus-visible:shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549]",
        glowActive: "bg-[#1a1a1a] text-white border border-transparent shadow-[0_0_0_1px_#b8b2b2,0_0_0_5px_#434549]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
