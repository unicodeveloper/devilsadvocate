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

  async answer(query: string, options: Record<string, unknown> = {}) {
    return this.call("/v1/answer", "POST", {
      query,
      ...(toSnakeCase(options) as Record<string, unknown>),
    });
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
