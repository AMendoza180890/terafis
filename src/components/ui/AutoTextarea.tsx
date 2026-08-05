"use client";

import { useCallback, useEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Altura mínima en filas (también se usa como `rows` inicial). */
  minRows?: number;
};

function resize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Textarea que crece/encoge según el contenido.
 */
export function AutoTextarea({
  minRows = 2,
  rows,
  className = "",
  onChange,
  value,
  defaultValue,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const initialRows = rows ?? minRows;

  const sync = useCallback(() => {
    const el = ref.current;
    if (el) resize(el);
  }, []);

  useEffect(() => {
    sync();
  }, [sync, value, defaultValue]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={initialRows}
      value={value}
      defaultValue={defaultValue}
      onChange={(e) => {
        resize(e.currentTarget);
        onChange?.(e);
      }}
      className={["[field-sizing:content] resize-none overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
