"use client";

import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand font-semibold text-white hover:opacity-90",
  secondary:
    "border-brand/30 bg-surface text-brand border font-medium hover:bg-brand-soft",
  ghost: "bg-brand-soft/60 text-brand font-medium hover:bg-brand-soft",
  danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40",
};

type Props = {
  href?: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
  /** Compacto: no estira a 100% en móvil (enlaces “volver”, chips). */
  inline?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/**
 * Acción de UI como botón (no link subrayado).
 * Si se pasa `href`, navega con el router al hacer clic.
 * Por defecto ocupa el 100% del ancho en móvil (`sm` y arriba: auto).
 */
export function ActionButton({
  href,
  variant = "primary",
  children,
  className = "",
  inline = false,
  onClick,
  type = "button",
  ...rest
}: Props) {
  const router = useRouter();

  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm transition-opacity disabled:opacity-50",
        inline ? "" : "w-full sm:w-auto",
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && href) {
          router.push(href);
        }
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
