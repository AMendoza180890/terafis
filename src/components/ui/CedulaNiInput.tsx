"use client";

import { useState, type ChangeEvent } from "react";

import {
  CEDULA_NI_LENGTH,
  CEDULA_NI_PLACEHOLDER,
  formatCedulaNiInput,
} from "@/lib/validation/cedula-ni";

type Props = {
  name?: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
  disabled?: boolean;
};

export function CedulaNiInput({
  name = "cedula",
  label = "Cédula",
  required = false,
  defaultValue = "",
  disabled = false,
}: Props) {
  const [value, setValue] = useState(() =>
    defaultValue ? formatCedulaNiInput(defaultValue) : "",
  );

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(formatCedulaNiInput(e.target.value));
  }

  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={CEDULA_NI_PLACEHOLDER}
        maxLength={CEDULA_NI_LENGTH}
        pattern={required ? "\\d{3}-\\d{6}-\\d{4}[A-Z]" : undefined}
        title="Formato: 000-000000-0000A (opcional)"
        className="border-brand/20 bg-background w-full rounded-md border px-3 py-2 font-mono tracking-wide uppercase disabled:opacity-70"
      />
    </label>
  );
}
