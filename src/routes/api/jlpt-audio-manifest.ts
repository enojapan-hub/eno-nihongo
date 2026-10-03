import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseTimeline } from "@/lib/chokai-timeline";

const LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);

export const Route = createFileRoute("/api/jlpt-audio-manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const level = url.searchParams.get("level")?.trim().toUpperCase();

        if (!level || !LEVELS.has(level)) {
          return Response.json({ error: "Invalid JLPT level" }, { status: 400 });
        }

        const examParam = Number(url.searchParams.get("exam") ?? "1");
        const examNo = Number.isInteger(examParam) && examParam >= 1 ? examParam : 1;

        // select("*"): kolom exam_no / question_timeline bersifat opsional, sehingga manifest
        // tetap berfungsi sebelum migrasi 20261004000000 diterapkan.
        const { data, error } = await supabaseAdmin
          .from("jlpt_simulation_audio_source_map")
          .select("*")
          .eq("level", level)
          .in("mapping_scope", ["mondai", "session"])
          .in("status", ["aligned", "ready"])
          .eq("structure_verified", true)
          .order("mondai_no", { ascending: true, nullsFirst: true });

        if (error) {
          console.error("JLPT grouped audio manifest lookup failed", error);
          return Response.json({ error: "Audio manifest lookup failed" }, { status: 500 });
        }

        const items = (data ?? [])
          .filter((row) => Number((row as Record<string, unknown>)["exam_no"] ?? 1) === examNo)
          .map((row) => ({
            id: String(row.id),
            level: String(row.level),
            mondai_no: row.mondai_no == null ? null : Number(row.mondai_no),
            mapping_scope: row.mapping_scope === "mondai" ? "mondai" : "session",
            delivery_path:
              row.delivery_path || `/api/jlpt-audio?id=${encodeURIComponent(String(row.id))}`,
            timeline: parseTimeline((row as Record<string, unknown>)["question_timeline"]),
          }));

        return Response.json(
          { items },
          {
            headers: {
              "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      },
    },
  },
});
