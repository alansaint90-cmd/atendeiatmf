import { receiveEvolutionEvent } from "@/lib/evolution/webhook";
import { enqueueEvolutionEvent } from "@/lib/evolution/queue";
import { effectiveSettings } from "@/lib/settings/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await receiveEvolutionEvent(request, await effectiveSettings(), enqueueEvolutionEvent);
  } catch {
    return Response.json({ error: "Configurações indisponíveis no servidor." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export function GET() {
  return Response.json({ service: "AtendeIA Evolution webhook", method: "POST", mode: "queue-only" }, { headers: { "Cache-Control": "no-store" } });
}
