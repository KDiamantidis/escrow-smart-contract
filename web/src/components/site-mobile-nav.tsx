"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";

import { NAV_ITEMS } from "@/components/site-nav-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SiteMobileNavProps {
  className?: string;
}

export function SiteMobileNav({ className }: SiteMobileNavProps) {
  const pathname = usePathname();

  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("md:hidden", className)}
            aria-label="Open navigation menu"
          />
        }
      >
        <Menu className="size-4" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(86vw,22rem)] flex-col border-l border-border/60 bg-background p-5 shadow-2xl outline-none">
          <div className="mb-6 flex items-center justify-between">
            <p className="font-heading text-sm font-medium tracking-tight text-foreground/80">
              Navigation
            </p>
            <Dialog.Close
              render={
                <Button type="button" variant="ghost" size="icon" aria-label="Close menu" />
              }
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <nav aria-label="Mobile main" className="flex flex-1 flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Dialog.Close
                  key={item.href}
                  render={
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-muted text-foreground"
                          : "text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                      )}
                    />
                  }
                >
                  {item.label}
                </Dialog.Close>
              );
            })}
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
