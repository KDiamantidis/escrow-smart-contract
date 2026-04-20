"use client";

import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Visible label for the primary confirm button. */
  confirmLabel: string;
  /** Visible label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Style of the confirm button. "destructive" for refund/dispute, "default" otherwise. */
  confirmVariant?: "default" | "destructive" | "secondary";
  /** Disables interactions while a transaction is being submitted. */
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmVariant = "default",
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            "transition-opacity duration-200"
          )}
        />
        <AlertDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-border/70 bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.97]",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.97]",
            "transition-[opacity,transform] duration-200 ease-out",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          )}
        >
          <AlertDialog.Title className="font-heading text-base font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              render={
                <Button variant="outline" disabled={busy}>
                  {cancelLabel}
                </Button>
              }
            />
            <Button
              variant={confirmVariant}
              disabled={busy}
              onClick={() => onConfirm()}
            >
              {busy ? "Submitting…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
