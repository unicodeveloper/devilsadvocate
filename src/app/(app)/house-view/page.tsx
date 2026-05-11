import {
  countHouseViewVersions,
  getLatestHouseViewVersion,
  getSeedHouseViewOwnerId,
  listHouseViewVersions,
  readHouseView,
} from "@/lib/house-view";
import { auth } from "@/lib/auth";
import { HouseViewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function HouseViewPage() {
  const session = await auth();

  // Signed-in users edit their own House View. Unauthed visitors see the
  // demo FM's as a read-only example (same pattern as the memos page).
  const ownerId =
    session?.user.id ?? (await getSeedHouseViewOwnerId());

  const [content, latest, versions, totalVersions] = await Promise.all([
    readHouseView(ownerId),
    ownerId ? getLatestHouseViewVersion(ownerId) : Promise.resolve(null),
    ownerId
      ? listHouseViewVersions(ownerId, 25)
      : Promise.resolve([] as Awaited<ReturnType<typeof listHouseViewVersions>>),
    ownerId ? countHouseViewVersions(ownerId) : Promise.resolve(0),
  ]);

  return (
    <HouseViewClient
      initialContent={content}
      lastUpdatedAt={latest?.createdAt ?? null}
      latestAuthorName={
        versions[0]?.authorName ?? versions[0]?.authorEmail ?? null
      }
      versions={versions.map((v) => ({
        id: v.id,
        createdAt: v.createdAt.toISOString(),
        authorName: v.authorName,
        authorEmail: v.authorEmail,
        content: v.content,
      }))}
      totalVersions={totalVersions}
      currentUserRole={session?.user.role ?? null}
      isViewingExample={!session}
    />
  );
}
