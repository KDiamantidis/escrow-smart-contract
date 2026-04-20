"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/how-it-works", label: "How it Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contributors", label: "Contributors" },
  { href: "/explore", label: "Explore" },
];

interface SiteNavLinksProps {
  className?: string;
}

export function SiteNavLinks({ className }: SiteNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "hidden items-center gap-4 md:flex",
        className
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-sm tracking-tight transition-colors",
              active
                ? "text-foreground"
                : "text-foreground/70 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
