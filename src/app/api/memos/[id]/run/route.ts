import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoById } from "@/lib/memos";
import {
  eventsToNdjsonStream,
  runStressTest,
} from "@/lib/agents/orchestrator";
import { fileToValyuAttachment } from "@/lib/valyu";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "fund_manager") {
    return NextResponse.json(
      { error: "Only Fund Managers can run stress-tests" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const memo = await getMemoById(id, { ownerId: session.user.id });
  if (!memo) {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let attachments: Awaited<ReturnType<typeof fileToValyuAttachment>>[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const fileEntries = formData.getAll("files").filter((v): v is File => v instanceof File);
    attachments = await Promise.all(
      fileEntries.map((f) =>
        fileToValyuAttachment(
          f,
          `Uploaded by analyst at memo run-time: ${f.name}`,
        ),
      ),
    );
  }

  const events = runStressTest({ memoId: memo.id, attachments });
  const stream = eventsToNdjsonStream(events);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
