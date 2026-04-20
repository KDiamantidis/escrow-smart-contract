"use client";

import { useState, type SVGProps } from "react";

import { cn } from "@/lib/utils";
import { ContributorTiltCard } from "@/components/ui/contributor-tilt-card";

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

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  image: string;
  githubUrl: string;
}

const DEFAULT_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Charalampos Efthymiadis",
    role: "Front-End Developer",
    image: "/images/contributors/profilehid.png",
    githubUrl: "https://github.com/xampos101",
  },
  {
    id: "2",
    name: "Konstantinos Diamantidis",
    role: "Backend Developer",
    image: "/images/contributors/diamantidis.jpg",
    githubUrl: "https://github.com/KDiamantidis",
  },
  {
    id: "3",
    name: "Stavros Stavridis",
    role: "Unit Tester",
    image: "/images/contributors/stavros.jpg",
    githubUrl: "https://github.com/Roulss",
  },
  {
    id: "4",
    name: "Fotis Korakis",
    role: "DevOps Engineer",
    image: "/images/contributors/fotis.jpg",
    githubUrl: "https://github.com/foootis",
  },
];

interface TeamShowcaseProps {
  members?: TeamMember[];
}

/**
 * Contributors layout: uniformly-sized tilt cards on the left and a stretched
 * name/role list on the right. Hover state is shared in both directions —
 * hovering a card highlights its list row, hovering a list row highlights its
 * card (and dims the others) for fast visual scanning.
 */
export function ContributorsTeamShowcase({
  members = DEFAULT_MEMBERS,
}: TeamShowcaseProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col items-stretch gap-7 select-none lg:flex-row lg:gap-9 xl:gap-10">
      <div className="grid w-full flex-1 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {members.map((m, i) => {
          const isActive = hoveredId === m.id;
          const isDimmed = hoveredId !== null && !isActive;
          return (
            <ContributorTiltCard
              key={m.id}
              name={m.name}
              image={m.image}
              githubUrl={m.githubUrl}
              priority={i === 0}
              isActive={isActive}
              isDimmed={isDimmed}
              onHoverChange={(active) =>
                setHoveredId(active ? m.id : null)
              }
            />
          );
        })}
      </div>

      <ul className="flex w-full flex-col justify-between gap-3 self-stretch sm:grid sm:grid-cols-2 sm:gap-4 lg:ml-3 lg:flex lg:w-[17rem] lg:flex-col lg:gap-0 xl:ml-4 xl:w-[20rem]">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({
  member,
  hoveredId,
  onHover,
}: {
  member: TeamMember;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const isActive = hoveredId === member.id;
  const isDimmed = hoveredId !== null && !isActive;

  return (
    <li
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "group flex min-w-0 flex-col justify-center py-1 transition-opacity duration-300",
        isDimmed ? "opacity-45" : "opacity-100"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "h-3 flex-shrink-0 rounded-[5px] transition-all duration-300",
            isActive ? "w-5 bg-foreground" : "w-4 bg-foreground/25"
          )}
        />
        <span
          className={cn(
            "font-heading text-sm font-semibold tracking-tight transition-colors duration-300 md:text-base xl:text-lg",
            isActive ? "text-foreground" : "text-foreground/80"
          )}
        >
          {member.name}
        </span>
        <a
          href={member.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${member.name}'s GitHub profile`}
          onFocus={() => onHover(member.id)}
          onBlur={() => onHover(null)}
          className={cn(
            "ml-1 inline-flex size-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all duration-200",
            "hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActive
              ? "translate-x-0 opacity-100"
              : "-translate-x-1 opacity-0 pointer-events-none"
          )}
        >
          <GithubMark className="size-3.5" />
        </a>
      </div>
      <p className="mt-1 truncate pl-[27px] text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase md:text-[11px]">
        {member.role}
      </p>
    </li>
  );
}

