import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-coral-strong text-white hover:bg-coral-deep shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-cream",
  ghost: "text-ink hover:bg-cream",
  danger: "bg-danger text-white hover:brightness-95",
} as const;

const sizes = {
  md: "min-h-12 px-5 text-base",
  sm: "min-h-10 px-4 text-sm",
} as const;

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
};

export function Button({ className, variant = "primary", size = "md", asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
