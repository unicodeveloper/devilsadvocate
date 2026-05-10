import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssuerGroupWithMembers } from "@/lib/funds";
import { GatedForm } from "@/components/gated-form";
import { Badge } from "@/components/ui";
import {
  addMemberAction,
  deleteGroupAction,
  removeMemberAction,
  updateGroupAction,
} from "../actions";

export const dynamic = "force-dynamic";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

const PRIMARY_BTN_CLS =
  "inline-flex h-8 items-center justify-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getIssuerGroupWithMembers(id);
  if (!group) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/groups"
          className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          All groups
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-text">
          {group.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-subtle tabular-nums">
          <span>
            {group.members.length} ticker
            {group.members.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span className="text-text-subtle">Updated</span>{" "}
            <span className="text-text-muted">
              {group.updatedAt.toLocaleString()}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <Link
            href={`/exposure?type=group&id=${group.id}`}
            className="text-accent transition-opacity hover:opacity-80"
          >
            View exposure →
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          Edit metadata
        </h2>
        <GatedForm
          action={updateGroupAction}
          reason="Sign in to update this group."
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={group.id} />
          <input
            name="name"
            defaultValue={group.name}
            className={INPUT_CLS}
          />
          <textarea
            name="notes"
            defaultValue={group.notes ?? ""}
            placeholder="Notes (optional)"
            rows={2}
            className={INPUT_CLS}
          />
          <div className="flex justify-end">
            <button type="submit" className={PRIMARY_BTN_CLS}>
              Save
            </button>
          </div>
        </GatedForm>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            Members
          </h2>
        </header>
        <ul className="divide-y divide-border">
          {group.members.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-subtle">
              No members yet. Add tickers below.
            </li>
          ) : (
            group.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="font-mono text-sm font-semibold text-text">
                  {m.ticker}
                </span>
                <GatedForm
                  action={removeMemberAction}
                  reason="Sign in to edit this group."
                >
                  <input type="hidden" name="memberId" value={m.id} />
                  <input type="hidden" name="groupId" value={group.id} />
                  <button
                    type="submit"
                    className="text-xs text-text-subtle transition-colors hover:text-danger"
                  >
                    Remove
                  </button>
                </GatedForm>
              </li>
            ))
          )}
        </ul>
        <GatedForm
          action={addMemberAction}
          reason="Sign in to add a member."
          className="flex items-center gap-2 border-t border-border bg-surface-2 px-4 py-3"
        >
          <input type="hidden" name="groupId" value={group.id} />
          <input
            name="ticker"
            placeholder="Add ticker (e.g. AAPL, ADANIPORTS.NS)"
            required
            className={`flex-1 ${INPUT_CLS} font-mono`}
          />
          <button type="submit" className={PRIMARY_BTN_CLS}>
            Add
          </button>
        </GatedForm>
      </section>

      <section
        className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft p-4"
        aria-labelledby="danger-zone-heading"
      >
        <h2
          id="danger-zone-heading"
          className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-danger"
        >
          <Badge tone="danger" dot>
            Danger zone
          </Badge>
        </h2>
        <GatedForm
          action={deleteGroupAction}
          reason="Sign in to delete this group."
          className="flex items-center justify-between gap-3"
        >
          <p className="text-xs text-text-muted">
            Deleting this group is permanent. Memos and funds are unaffected.
          </p>
          <input type="hidden" name="id" value={group.id} />
          <button
            type="submit"
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-transparent px-3 text-xs font-medium text-danger transition-colors hover:bg-[color-mix(in_oklab,var(--danger)_15%,transparent)]"
          >
            Delete group
          </button>
        </GatedForm>
      </section>
    </div>
  );
}
