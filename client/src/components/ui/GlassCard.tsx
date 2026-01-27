import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    /** Add subtle primary glow effect */
    glow?: boolean;
    /** Add top highlight border */
    highlight?: boolean;
    /** Card padding preset */
    padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
};

/**
 * GlassCard - Premium glassmorphism card component
 * 
 * Features:
 * - Semi-transparent background with backdrop blur
 * - Subtle white border for glass effect
 * - Optional glow and highlight effects
 * - Consistent with dark mode design tokens
 * 
 * @example
 * ```tsx
 * <GlassCard padding="md" glow>
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </GlassCard>
 * ```
 */
export function GlassCard({
    children,
    className,
    glow = false,
    highlight = false,
    padding = "md",
    ...props
}: GlassCardProps) {
    return (
        <div
            className={cn(
                // Base glass effect
                "bg-slate-900/40 dark:bg-slate-900/40",
                "backdrop-blur-xl",
                "border border-white/10",
                "rounded-2xl",
                "shadow-2xl",
                // Transition for smooth interactions
                "transition-all duration-300",
                // Optional glow effect
                glow && "shadow-primary/20 hover:shadow-primary/30",
                // Optional top highlight (simulates light reflection)
                highlight && "border-t-white/20",
                // Padding
                paddingClasses[padding],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * GlassCardHeader - Header section for GlassCard
 */
export function GlassCardHeader({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex items-center justify-between mb-4",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * GlassCardTitle - Title for GlassCard headers
 */
export function GlassCardTitle({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={cn(
                "text-sm font-semibold text-slate-200",
                className
            )}
            {...props}
        >
            {children}
        </h3>
    );
}

/**
 * GlassCardContent - Content area for GlassCard
 */
export function GlassCardContent({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("", className)} {...props}>
            {children}
        </div>
    );
}

/**
 * GlassCardFooter - Footer section for GlassCard
 */
export function GlassCardFooter({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "mt-4 pt-4 border-t border-white/5",
                "flex items-center justify-between",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
