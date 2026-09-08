/**
 * Badge Component
 * 
 * Migrated from Vite frontend (Badge.jsx)
 * Includes both standard Badge and DriveStatusBadge variants
 * Converted to TypeScript with Tailwind utilities and class-variance-authority
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Base styles for standard badge
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        // Accent/Primary - terracotta
        accent: "bg-accent-light text-accent-dark",
        
        // Green/Teal - success, active states
        green: "bg-teal-light text-teal",
        teal: "bg-teal-light text-teal",
        
        // Amber - warnings, pending states
        amber: "bg-amber-light text-amber",
        
        // Red - errors, rejected states
        red: "bg-red-light text-red",
        
        // Purple - special highlights
        purple: "bg-purple-light text-purple",
        
        // Outline - neutral with border
        outline: "border border-border bg-transparent text-text-secondary",
        
        // Secondary - neutral gray
        secondary: "bg-surface-1 text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "accent",
    },
  }
);

const driveStatusBadgeVariants = cva(
  // Base styles for drive status badge (bigger, brighter)
  "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold transition-colors",
  {
    variants: {
      variant: {
        accent: "bg-accent text-white",
        green: "bg-teal text-white",
        teal: "bg-teal text-white",
        amber: "bg-amber text-white",
        red: "bg-red text-white",
        purple: "bg-purple text-white",
      },
    },
    defaultVariants: {
      variant: "accent",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export interface DriveStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof driveStatusBadgeVariants> {}

/**
 * Standard Badge - small, subtle, pill-shaped indicator
 * 
 * @example
 * ```tsx
 * <Badge variant="green">Active</Badge>
 * <Badge variant="amber">Pending</Badge>
 * <Badge variant="red">Rejected</Badge>
 * ```
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * DriveStatusBadge - larger, bolder badge for drive status display
 * Used in drive cards and listings for prominent status indication
 * 
 * @example
 * ```tsx
 * <DriveStatusBadge variant="green">Open</DriveStatusBadge>
 * <DriveStatusBadge variant="red">Closed</DriveStatusBadge>
 * ```
 */
function DriveStatusBadge({ className, variant, ...props }: DriveStatusBadgeProps) {
  return (
    <span className={cn(driveStatusBadgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, DriveStatusBadge, badgeVariants, driveStatusBadgeVariants };
