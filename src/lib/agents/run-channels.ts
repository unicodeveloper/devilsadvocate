import { runStressTest, type RunEvent, type RunInput } from "./orchestrator";

/**
 * In-memory event bus for a single in-flight stress-test run.
 *
 * The orchestrator drives the channel; the HTTP response is a passive
 * subscriber. When the client disconnects, the response unsubscribes —
 * the orchestrator keeps running, the channel keeps buffering. This is
 * what lets a stress-test survive the user navigating away.
 *
 * All buffered events are kept so a late or reconnecting subscriber
 * receives the full history, not just the events that happen after they
 * connect. Runs produce ~10 events total, so the memory cost is trivial.
 */
export class RunChannel {
  readonly memoId: string;
  private events: RunEvent[] = [];
  private subscribers = new Set<(e: RunEvent) => void>();
  private closeCallbacks = new Set<() => void>();
  private _closed = false;

  constructor(memoId: string) {
    this.memoId = memoId;
  }

  get closed(): boolean {
    return this._closed;
  }

  emit(event: RunEvent): void {
    if (this._closed) return;
    this.events.push(event);
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        // Per-subscriber failures must not poison the bus.
      }
    }
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    const callbacks = [...this.closeCallbacks];
    this.subscribers.clear();
    this.closeCallbacks.clear();
    for (const fn of callbacks) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Async iterator yielding every buffered event first, then any future
   * events until the channel closes. Multiple subscribers are independent.
   */
  async *subscribe(): AsyncGenerator<RunEvent, void, unknown> {
    let cursor = 0;
    while (cursor < this.events.length) {
      yield this.events[cursor++];
    }
    if (this._closed) return;

    const pending: RunEvent[] = [];
    let wake: (() => void) | null = null;
    let done = false;

    const onEvent = (e: RunEvent) => {
      pending.push(e);
      if (wake) {
        const w = wake;
        wake = null;
        w();
      }
    };
    const onClose = () => {
      done = true;
      if (wake) {
        const w = wake;
        wake = null;
        w();
      }
    };

    this.subscribers.add(onEvent);
    this.closeCallbacks.add(onClose);

    try {
      while (true) {
        while (pending.length > 0) {
          yield pending.shift()!;
        }
        if (done) return;
        await new Promise<void>((r) => {
          wake = r;
        });
      }
    } finally {
      this.subscribers.delete(onEvent);
      this.closeCallbacks.delete(onClose);
    }
  }
}

// Module-global. Persists for the lifetime of the Node process.
// Keyed by memoId because at most one run is in flight per memo at a time.
const registry = new Map<string, RunChannel>();

export function getChannel(memoId: string): RunChannel | null {
  return registry.get(memoId) ?? null;
}

/**
 * Starts a stress-test in a detached background promise whose lifecycle is
 * independent of any HTTP response. Returns the channel so the caller can
 * subscribe and stream events back to the client — but the run will
 * complete and persist regardless of whether the caller stays connected.
 *
 * If a run is already in flight for the same memo, returns the existing
 * channel instead of starting a duplicate.
 */
export function startRunDetached(input: RunInput): RunChannel {
  const existing = registry.get(input.memoId);
  if (existing && !existing.closed) return existing;

  const ch = new RunChannel(input.memoId);
  registry.set(input.memoId, ch);

  void (async () => {
    try {
      for await (const event of runStressTest(input)) {
        ch.emit(event);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ch.emit({ type: "run_failed", runId: "", error: message });
    } finally {
      ch.close();
      // Grace window: late reconnectors can still pull the final events
      // from this still-registered channel. After that, drop it — the DB
      // has the authoritative final state of the run.
      setTimeout(() => {
        if (registry.get(input.memoId) === ch) {
          registry.delete(input.memoId);
        }
      }, 30_000);
    }
  })();

  return ch;
}

export function channelToNdjsonStream(
  ch: RunChannel,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of ch.subscribe()) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            // Client disconnected — enqueue throws once the controller is
            // closed. Bail out of the subscription, but do NOT touch the
            // channel: other subscribers (and the orchestrator) carry on.
            return;
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
}
