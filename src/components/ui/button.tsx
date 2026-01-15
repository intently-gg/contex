import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import "./button-hover.css"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "border border-primary/20 bg-primary text-primary-foreground [&:hover:not(:disabled)]:!bg-primary/70 [&:hover:not(:disabled)]:!border-primary/80 hover:shadow-md active:scale-95",
        destructive:
          "border border-destructive/20 bg-destructive text-destructive-foreground [&:hover:not(:disabled)]:!bg-destructive/70 [&:hover:not(:disabled)]:!border-destructive/80 hover:shadow-md active:scale-95",
        outline:
          "border border-input bg-muted/60 [&:hover:not(:disabled)]:!bg-accent [&:hover:not(:disabled)]:!text-accent-foreground [&:hover:not(:disabled)]:!border-accent/80 hover:shadow-md active:scale-95",
        secondary:
          "border border-secondary/20 bg-secondary text-secondary-foreground [&:hover:not(:disabled)]:!bg-secondary/60 [&:hover:not(:disabled)]:!border-secondary/80 hover:shadow-md active:scale-95",
        ghost:
          "border border-transparent bg-muted/40 [&:hover:not(:disabled)]:!bg-accent [&:hover:not(:disabled)]:!text-accent-foreground [&:hover:not(:disabled)]:!border-accent/60 hover:shadow-md active:scale-95",
        link: "text-primary underline-offset-4 hover:underline border-0 bg-transparent hover:bg-transparent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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
  ({ className, variant, size, asChild = false, onMouseEnter, onMouseLeave, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const [isHovered, setIsHovered] = React.useState(false)
    
    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(true)
      onMouseEnter?.(e)
    }
    
    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(false)
      onMouseLeave?.(e)
    }
    
    // Calculate hover styles based on variant
    const hoverStyle = React.useMemo(() => {
      if (!isHovered || props.disabled) return {}
      
      const root = document.documentElement
      const getCSSVar = (varName: string) => {
        return getComputedStyle(root).getPropertyValue(varName).trim()
      }
      
      switch (variant) {
        case "outline":
          return {
            backgroundColor: `hsl(${getCSSVar("--accent")})`,
            color: `hsl(${getCSSVar("--accent-foreground")})`,
            borderColor: `hsl(${getCSSVar("--accent")} / 0.8)`,
          }
        case "default":
          return {
            backgroundColor: `hsl(${getCSSVar("--primary")} / 0.7)`,
            borderColor: `hsl(${getCSSVar("--primary")} / 0.8)`,
          }
        case "ghost":
          return {
            backgroundColor: `hsl(${getCSSVar("--accent")})`,
            color: `hsl(${getCSSVar("--accent-foreground")})`,
            borderColor: `hsl(${getCSSVar("--accent")} / 0.6)`,
          }
        case "secondary":
          return {
            backgroundColor: `hsl(${getCSSVar("--secondary")} / 0.6)`,
            borderColor: `hsl(${getCSSVar("--secondary")} / 0.8)`,
          }
        case "destructive":
          return {
            backgroundColor: `hsl(${getCSSVar("--destructive")} / 0.7)`,
            borderColor: `hsl(${getCSSVar("--destructive")} / 0.8)`,
          }
        default:
          return {}
      }
    }, [isHovered, variant, props.disabled])
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ ...style, ...hoverStyle }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

