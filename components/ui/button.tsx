/**
 * Button Component
 * 
 * Migrated from Vite frontend (Button.jsx)
 * Converted to TypeScript with Tailwind utilities and class-variance-authority
 */

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: Accent background (terracotta)
        primary: "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark",
        
        // Outline: Border with no background
        outline: "border border-border bg-transparent text-text-primary hover:bg-surface-1 hover:border-border-strong active:bg-surface-1",
        
        // Ghost: No border, subtle hover
        ghost: "bg-transparent text-text-secondary hover:bg-surface-1 hover:text-text-primary active:bg-surface-1",
        
        // Danger: Red for destructive actions
        danger: "bg-red text-white hover:bg-red/90 active:bg-red/90",
        
        // Link: Looks like a link
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8 px-3 py-1.5 text-xs rounded-md",
        lg: "h-12 px-6 py-3 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * If true, the button will render as a Slot component
   * allowing it to merge with a child component
   */
  asChild?: boolean;
}

/**
 * Button component with multiple variants and sizes
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="default">
 *   Click me
 * </Button>
 * 
 * <Button variant="outline" size="sm">
 *   Small button
 * </Button>
 * 
 * <Button variant="danger" disabled>
 *   Disabled
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
