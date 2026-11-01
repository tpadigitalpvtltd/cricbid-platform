import { subscribeToAuctionStream, getFullAuctionState } from '@/lib/auctionStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = (params?.slug || '').toLowerCase();
  if (!slug) {
    return new Response('Slug required', { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (payload: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {}
      };

      // 1. Subscribe immediately to in-memory event bus (0.1ms push)
      unsubscribe = subscribeToAuctionStream(slug, (payload) => {
        sendEvent(payload);
      });

      // 2. Send initial live state snapshot
      try {
        const initialState = await getFullAuctionState(slug);
        if (initialState) {
          sendEvent({
            event: 'INITIAL_STATE',
            state: { ...initialState, playersQueue: [] },
            timestamp: Date.now(),
          });
        }
      } catch {}

      // 3. Keep connection alive through proxies/tunnels
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {}
      }, 15000);

      request.signal.addEventListener('abort', () => {
        if (unsubscribe) unsubscribe();
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
