import {
  countHouseViewVersions,
  getLatestHouseViewVersion,
  listHouseViewVersions,
  readHouseView,
} from "@/lib/house-view";
import { auth } from "@/lib/auth";
import { HouseViewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function HouseViewPage() {
  const [content, latest, versions, totalVersions, session] = await Promise.all([
    readHouseView(),
    getLatestHouseViewVersion(),
    listHouseViewVersions(25),
    countHouseViewVersions(),
    auth(),
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
    />
  );
}
