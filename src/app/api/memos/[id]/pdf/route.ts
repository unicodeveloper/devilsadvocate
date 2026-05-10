import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getLatestCompletedRun,
  getMemoById,
  getReviewerInfo,
  parseFundSynthesizedMemo,
  parseSynthesizedMemo,
} from "@/lib/memos";
import { getFundById } from "@/lib/funds";
import { renderMemoToHtml } from "@/lib/pdf/render";
import { renderFundMemoToHtml } from "@/lib/pdf/fund-render";
import { htmlToPdf } from "@/lib/pdf/playwright";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const memo = await getMemoById(
    id,
    session.user.role === "fund_manager"
      ? { ownerId: session.user.id }
      : undefined,
  );
  if (!memo) {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }
  if (session.user.role === "cio" && memo.status === "draft") {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }

  const [latestRun, reviewer] = await Promise.all([
    getLatestCompletedRun(memo.id),
    getReviewerInfo(memo.reviewedByUserId),
  ]);

  if (!latestRun) {
    return NextResponse.json(
      {
        error:
          "No completed stress-test run yet. Generate one before downloading the memo.",
      },
      { status: 409 },
    );
  }

  const reviewerInfo = memo.reviewedByUserId
    ? { name: reviewer?.name ?? null, comment: memo.reviewComment }
    : null;
  const generatedAt = latestRun.finishedAt ?? new Date();

  let html: string;
  let filenameStem: string;

  if (memo.entityType === "fund") {
    const synthesized = parseFundSynthesizedMemo(latestRun.synthesizedMemoJson);
    const fund = memo.fundId ? await getFundById(memo.fundId) : null;
    if (!synthesized || !fund) {
      return NextResponse.json(
        { error: "Fund memo data missing" },
        { status: 409 },
      );
    }
    html = renderFundMemoToHtml({
      memo,
      fund,
      synthesized,
      generatedAt,
      reviewer: reviewerInfo,
    });
    filenameStem = fund.name.replace(/\s+/g, "-").slice(0, 40);
  } else {
    const synthesized = parseSynthesizedMemo(latestRun.synthesizedMemoJson);
    if (!synthesized) {
      return NextResponse.json(
        { error: "Stock memo data missing" },
        { status: 409 },
      );
    }
    html = renderMemoToHtml({
      memo,
      synthesized,
      generatedAt,
      reviewer: reviewerInfo,
    });
    filenameStem = memo.stockTicker ?? "memo";
  }

  let pdf: Uint8Array;
  try {
    pdf = await htmlToPdf(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF render failed";
    return NextResponse.json(
      {
        error:
          msg.includes("Executable doesn't exist") ||
          msg.includes("browserType.launch")
            ? `${msg}. Run "npx playwright install chromium" once on this machine.`
            : msg,
      },
      { status: 500 },
    );
  }

  const filename = `${filenameStem}-${memo.id.slice(0, 8)}.pdf`;
  return new Response(new Blob([new Uint8Array(pdf)]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
