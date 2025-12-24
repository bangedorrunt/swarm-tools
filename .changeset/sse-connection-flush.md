---
"swarm-mail": patch
---

## 🐝 SSE Streams Now Actually Stream

Fixed a subtle bug where SSE connections would hang indefinitely when requesting live events from the current head offset.

**The Problem:**
When a client connects with `?live=true&offset=N` where N equals the current head (meaning "only send me NEW events"), the server had nothing to send immediately. Bun's `fetch()` would block waiting for the first byte, and the connection would timeout.

**The Fix:**
Send an SSE comment (`: connected\n\n`) at stream start to flush headers. SSE comments are ignored by clients but establish the connection immediately.

```typescript
// Before: fetch() hangs waiting for first byte
const stream = new ReadableStream({
  async start(controller) {
    // If no existing events, nothing gets enqueued
    // Client's fetch() blocks forever
  }
});

// After: connection established immediately
const stream = new ReadableStream({
  async start(controller) {
    controller.enqueue(encoder.encode(": connected\n\n"));
    // Client receives headers, can start reading
  }
});
```

**Bonus fix:** Added `startOffset` parameter to `subscribe()` to eliminate async initialization race condition.

All 18 durable-server tests now pass (was 17/18).
