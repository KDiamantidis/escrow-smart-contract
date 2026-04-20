"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  /** Visible label next to the icon. Omit for icon-only. */
  label?: string;
  className?: string;
  size?: "xs" | "sm" | "default";
  variant?: "ghost" | "outline" | "secondary";
  ariaLabel?: string;
}

export function CopyButton({
  value,
  label,
  className,
  size = "sm",
  variant = "ghost",
  ariaLabel,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const onCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked (insecure context); silently no-op
    }
  }, [value]);

  return (
    <Button
      variant={variant}
      size={label ? size : "icon-sm"}
      onClick={onCopy}
      aria-label={ariaLabel ?? (label ? undefined : "Copy to clipboard")}
      aria-live="polite"
      className={cn("gap-1.5", className)}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  );
}
