import Link from "next/link";
import { listIssuerGroupsWithCounts } from "@/lib/funds";
import { PageHeader } from "@/components/app-shell";
import { Badge, Button, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await listIssuerGroupsWithCounts();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Taxonomy"
        title="Issuer groups"
        description={
          <>
            Manual mapping of a group label (e.g. <em>Adani Group</em>) to a
            list of tickers. Used by the Exposure page for &ldquo;aggregate
            exposure to X across all funds.&rdquo;
          </>
        }
        actions={
          <Link href="/groups/new">
            <Button
              iconLeft={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              }
            >
              New group
            </Button>
          </Link>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<GroupIcon />}
          title="No groups yet"
          body="Define an issuer group to roll up exposure across multiple tickers — useful for conglomerates, family holdings, or any thematic bucket."
          action={
            <Link
              href="/groups/new"
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Create your first →
            </Link>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {groups.map((g, idx) => (
            <li
              key={g.id}
              className={idx > 0 ? "border-t border-border" : undefined}
            >
              <Link
                href={`/groups/${g.id}`}
                className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium text-text">
                    {g.name}
                  </span>
                  {g.notes ? (
                    <p className="line-clamp-1 text-xs text-text-muted">
                      {g.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone="neutral">
                    {g.memberCount} ticker{g.memberCount === 1 ? "" : "s"}
                  </Badge>
                  <ChevronRight />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text-muted"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
