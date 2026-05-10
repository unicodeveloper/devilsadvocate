"use client";

import type { LoadedObjection } from "@/lib/reviews-shared";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui";

type Severity = "BLOCKING" | "MAJOR" | "MINOR" | "INFO";
type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const SEVERITY_RANK: Record<Severity, number> = {
  BLOCKING: 4,
  MAJOR: 3,
  MINOR: 2,
  INFO: 1,
};

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  BLOCKING: "danger",
  MAJOR: "warning",
  MINOR: "info",
  INFO: "neutral",
};

/**
 * Small chip rendered next to a section heading when there are objections
 * anchored to that section. Click jumps the page to the matching card in
 * the review rail (cards have id={`objection-${id}`}).
 */
export function SectionBadge({
  section,
  objections,
}: {
  section: "thesis" | "areas_of_concern" | "private_peers" | "holdings" | "memo";
  objections: LoadedObjection[];
}) {
  const matching = objections.filter((o) => o.anchorSection === section);
  if (matching.length === 0) return null;

  const worst = matching.reduce<Severity>(
    (best, o) =>
      SEVERITY_RANK[o.severity as Severity] > SEVERITY_RANK[best]
        ? (o.severity as Severity)
        : best,
    "INFO",
  );
  const open = matching.filter((o) => o.status === "open").length;
  const total = matching.length;
  const label = open === total ? `${total}` : `${open}/${total}`;
  const tooltip = `${matching.length} objection${matching.length === 1 ? "" : "s"} on this section · worst: ${worst}`;
  const firstId = matching[0].id;

  return (
    <a
      href={`#objection-${firstId}`}
      title={tooltip}
      aria-label={tooltip}
      className="transition-opacity hover:opacity-80"
    >
      <Badge tone={SEVERITY_TONE[worst]} dot>
        {label} {open === total ? "open" : "outstanding"}
      </Badge>
    </a>
  );
}
