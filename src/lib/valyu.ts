import { Valyu } from "valyu-js";
import { isSelfHostedMode } from "@/app/lib/app-mode";

const VALYU_APP_URL =
  process.env.VALYU_APP_URL || "https://platform.valyu.ai";

let _valyu: Valyu | null = null;

/**
 * Returns a Valyu client.
 *
 * - Self-hosted mode: real `valyu-js` SDK keyed by `VALYU_API_KEY`.
 * - Valyu mode with an `accessToken`: a thin wrapper that routes all calls
 *   through Valyu's OAuth proxy (`${VALYU_APP_URL}/api/oauth/proxy`) so the
 *   signed-in user's Valyu credits are charged.
 * - Valyu mode without a token: falls back to the SDK + API key (e.g. for
 *   background jobs that don't have a user session).
 *
 * The returned object is typed as `Valyu` for drop-in compatibility; the
 * OAuth wrapper only implements the methods the agents actually use
 * (`search`, `answer`, `deepresearch.create`, `deepresearch.wait`,
 * `deepresearch.status`). Other methods throw at runtime.
 */
export function getValyu(accessToken?: string): Valyu {
  if (!isSelfHostedMode() && accessToken) {
    return new ValyuOAuthClient(accessToken) as unknown as Valyu;
  }
  if (_valyu) return _valyu;
  const apiKey = process.env.VALYU_API_KEY;
  if (!apiKey) {
    throw new Error("VALYU_API_KEY is required to call Valyu APIs");
  }
  _valyu = new Valyu(apiKey);
  return _valyu;
}

/**
 * Routes Valyu API calls through the platform OAuth proxy so the
 * authenticated user's credits are charged. Only implements the surface the
 * agents actually use.
 */
class ValyuOAuthClient {
  constructor(private readonly accessToken: string) {}

  deepresearch = {
    create: (options: Record<string, unknown>) =>
      this.call("/v1/deepresearch/tasks", "POST", toSnakeCase(options)),
    status: (taskId: string) =>
      this.call(`/v1/deepresearch/tasks/${taskId}/status`, "GET"),
    wait: async (
      taskId: string,
      options: { pollIntervalMs?: number; maxWaitMs?: number } = {},
    ) => {
      const pollInterval = options.pollIntervalMs ?? 5000;
      const maxWait = options.maxWaitMs ?? 2 * 60 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        const status = (await this.deepresearch.status(taskId)) as {
          status?: string;
        };
        if (
          status.status === "completed" ||
          status.status === "failed" ||
          status.status === "cancelled"
        ) {
          return status;
        }
        await sleep(pollInterval);
      }
      throw new Error(`Valyu DeepResearch task ${taskId} timed out`);
    },
  };

  async search(query: string, options: Record<string, unknown> = {}) {
    return this.call("/v1/search", "POST", {
      query,
      ...(toSnakeCase(options) as Record<string, unknown>),
    });
  }

  /**
   * Valyu `/v1/answer` is an SSE endpoint — even non-streaming consumers
   * get `data: {...}` chunks. We accumulate the stream client-side and
   * return the same shape the `valyu-js` SDK produces, so call-sites that
   * pattern-match on `success`/`contents`/`search_results` keep working
   * unchanged across modes.
   */
  async answer(query: string, options: Record<string, unknown> = {}) {
    const body = {
      query,
      ...(toSnakeCase(options) as Record<string, unknown>),
    };
    const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ path: "/v1/answer", method: "POST", body }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 402) {
        return {
          success: false,
          error: "Insufficient Valyu credits. Top up your account to continue.",
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: "Valyu session expired. Please sign in again.",
        };
      }
      return {
        success: false,
        error: `Valyu OAuth proxy returned ${res.status}: ${text || "no body"}`,
      };
    }

    // Read raw body and parse. Some proxies relay SSE verbatim, others
    // buffer it into JSON. Handle both.
    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    const looksLikeJson =
      !contentType.includes("event-stream") &&
      (text.trimStart().startsWith("{") || text.trimStart().startsWith("["));
    if (looksLikeJson) {
      try {
        return JSON.parse(text);
      } catch {
        // fall through to SSE
      }
    }
    return parseAnswerSse(text, body.query as string);
  }

  private async call(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, method, body }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 402) {
        throw new Error(
          "Insufficient Valyu credits. Top up your account to continue.",
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error("Valyu session expired. Please sign in again.");
      }
      throw new Error(
        `Valyu OAuth proxy returned ${res.status}: ${text || "no body"}`,
      );
    }
    return (await res.json()) as Record<string, unknown>;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Accumulate a Valyu `/v1/answer` SSE response into the same shape the
 * `valyu-js` SDK returns from `fetchAnswer`. Mirrors the SDK's logic:
 *
 *   - chunks with `parsed.choices[0].delta.content` → append to `contents`
 *   - chunks with `parsed.search_results` (without `success`) → accumulate
 *   - chunk with `parsed.success` (true|false) → final metadata
 *   - `data: [DONE]` → end of stream
 *
 * Returns `{ success: true, contents, search_results, ... }` on success
 * matching the SDK's response, or `{ success: false, error }` if no
 * success-metadata chunk arrived.
 */
function parseAnswerSse(text: string, query: string): Record<string, unknown> {
  let fullContent = "";
  let searchResults: unknown[] = [];
  let finalMetadata: Record<string, unknown> | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.startsWith("data: ")) continue;
    const dataStr = line.slice(6);
    if (dataStr === "[DONE]") continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataStr) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (
      Array.isArray(parsed.search_results) &&
      parsed.success === undefined
    ) {
      searchResults = [
        ...searchResults,
        ...(parsed.search_results as unknown[]),
      ];
    } else if (Array.isArray(parsed.choices)) {
      const choice = (parsed.choices as Array<Record<string, unknown>>)[0];
      const delta = choice?.delta as { content?: string } | undefined;
      if (delta?.content) fullContent += delta.content;
    } else if (parsed.success !== undefined) {
      finalMetadata = parsed;
    }
  }

  if (finalMetadata?.success) {
    const meta = finalMetadata;
    return {
      success: true,
      tx_id: meta.tx_id ?? "",
      original_query: meta.original_query ?? query,
      contents: meta.contents ?? fullContent ?? "",
      search_results: meta.search_results ?? searchResults,
      search_metadata: meta.search_metadata ?? {
        tx_ids: [],
        number_of_results: 0,
        total_characters: 0,
      },
      ai_usage: meta.ai_usage ?? { input_tokens: 0, output_tokens: 0 },
      cost: meta.cost ?? {
        total_deduction_dollars: 0,
        search_deduction_dollars: 0,
        ai_deduction_dollars: 0,
      },
    };
  }
  return {
    success: false,
    error:
      (finalMetadata?.error as string | undefined) ??
      "Valyu answer stream ended without a success chunk",
  };
}

/**
 * Recursively converts camelCase keys to snake_case. The Valyu HTTP API
 * expects snake_case; the SDK does this conversion internally, so the
 * OAuth wrapper has to do it explicitly.
 */
function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[camelToSnake(k)] = toSnakeCase(v);
    }
    return out;
  }
  return value;
}

function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export type ValyuFile = {
  data: string;
  filename: string;
  mediaType: string;
  context?: string;
};

export async function fileToValyuAttachment(
  file: File,
  context?: string,
): Promise<ValyuFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    context,
  };
}
