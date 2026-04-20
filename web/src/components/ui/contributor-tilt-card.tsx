"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type SVGProps } from "react";

import { cn } from "@/lib/utils";

const MAX_TILT_DEG = 7;
const TILT_SCALE = 1.03;

export interface ContributorTiltCardProps {
  name: string;
  image: string;
  githubUrl: string;
  /** Tailwind className for the outer card (width / aspect ratio / ordering). */
  className?: string;
  /** Priority hint for above-the-fold images. */
  priority?: boolean;
  /** Externally-controlled highlight (e.g. coming from a sibling list). */
  isActive?: boolean;
  /** Externally-controlled dim state (another sibling is active). */
  isDimmed?: boolean;
  /** Reports hover/focus transitions so sibling UI can react. */
  onHoverChange?: (active: boolean) => void;
}

function GithubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.7.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/**
 * Tilt-on-hover card with 3D perspective. Disables tilt on touch / narrow
 * viewports (`< md`) and when the user prefers reduced motion. The card is a
 * bare photo: all textual info (name, role, GitHub link) is rendered by the
 * parent alongside the card, so the image stays clean.
 */
export function ContributorTiltCard({
  name,
  image,
  githubUrl,
  className,
  priority,
  isActive,
  isDimmed,
  onHoverChange,
}: ContributorTiltCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const rafRef = useRef<number | null>(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [transform, setTransform] = useState<string>(
    "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

    const compute = () => {
      setTiltEnabled(!motion.matches && wide.matches && fine.matches);
    };
    compute();

    motion.addEventListener("change", compute);
    wide.addEventListener("change", compute);
    fine.addEventListener("change", compute);
    return () => {
      motion.removeEventListener("change", compute);
      wide.removeEventListener("change", compute);
      fine.removeEventListener("change", compute);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!tiltEnabled || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const rx = ((y - halfH) / halfH) * -MAX_TILT_DEG;
    const ry = ((x - halfW) / halfW) * MAX_TILT_DEG;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTransform(
        `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(
          2
        )}deg) scale3d(${TILT_SCALE},${TILT_SCALE},${TILT_SCALE})`
      );
    });
  };

  const reset = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTransform(
        "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)"
      );
    });
  };

  return (
    <a
      ref={cardRef}
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${name}'s GitHub profile`}
      onMouseMove={onMouseMove}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => {
        onHoverChange?.(false);
        reset();
      }}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => {
        onHoverChange?.(false);
        reset();
      }}
      style={{
        transform: tiltEnabled ? transform : undefined,
        transition: tiltEnabled
          ? "transform 0.18s ease-out, opacity 0.3s ease-out"
          : "transform 0.3s ease-out, opacity 0.3s ease-out",
        transformStyle: "preserve-3d",
        willChange: tiltEnabled ? "transform" : undefined,
      }}
      className={cn(
        "group relative block aspect-[3/4] w-full overflow-hidden rounded-3xl bg-card ring-1 ring-border/60",
        "shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDimmed ? "opacity-55" : "opacity-100",
        className
      )}
    >
      <Image
        src={image}
        alt={name}
        fill
        priority={priority}
        sizes="(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 320px"
        className="object-cover transition-[filter,transform] duration-500 will-change-transform"
        style={{
          filter: isActive
            ? "grayscale(0) brightness(1)"
            : "grayscale(0.65) brightness(0.85)",
          transform: tiltEnabled ? "translateZ(-20px) scale(1.06)" : undefined,
        }}
      />

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          "bg-gradient-to-t from-black/55 via-black/10 to-transparent",
          isActive ? "opacity-60" : "opacity-100"
        )}
      />

      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 inline-flex items-center justify-start gap-1.5 px-3 py-2.5 text-[11px] font-medium tracking-wide text-white",
          "bg-gradient-to-t from-black/70 via-black/45 to-transparent"
        )}
      >
        <GithubMark className="size-3" aria-hidden />
        View on GitHub
      </span>
    </a>
  );
}
