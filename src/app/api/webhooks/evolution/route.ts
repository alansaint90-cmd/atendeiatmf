import { receiveEvolutionEvent } from "@/lib/evolution/webhook";
import { enqueueEvolutionEvent } from "@/lib/evolution/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return receiveEvolutionEvent(request, process.env, enqueueEvolutionEvent);
}

export function GET() {
  return Response.json({ service: "AtendeIA Evolution webhook", method: "POST", mode: "queue-only" }, { headers: { "Cache-Control": "no-store" } });
}
