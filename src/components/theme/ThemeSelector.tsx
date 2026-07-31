"use client";

import type { ReactNode } from "react";

import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/roles";

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: ReactNode;
}> = [
  {
    value: "claro",
    label: "Claro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1"
        />
      </svg>
    ),
  },
  {
    value: "oscuro",
    label: "Oscuro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M16.5 3.5A8.5 8.5 0 1 0 20.5 14.5 6.5 6.5 0 0 1 16.5 3.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    value: "sistema",
    label: "Sistema",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <rect
          x="3"
          y="4"
          width="18"
          height="13"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 20h8M12 17v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="flex items-center gap-0.5" aria-label="Tema">
      <legend className="sr-only">Tema</legend>
      {OPTIONS.map((opt) => {
        const selected = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={selected}
            onClick={() => setTheme(opt.value)}
            className={
              selected
                ? "bg-brand inline-flex h-9 w-9 items-center justify-center rounded-md text-white"
                : "text-muted hover:bg-brand-soft hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
            }
          >
            {opt.icon}
          </button>
        );
      })}
    </fieldset>
  );
}
