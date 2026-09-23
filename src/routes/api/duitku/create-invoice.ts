import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applicationOrigin,
  createInvoiceSignature,
  DUITKU_PLANS,
  duitkuConfig,
  isDuitkuPlanCode,
} from "@/lib/duitku.server";

async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}

export const Route = createFileRoute("/api/duitku/create-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) return Response.json({ error: "Sesi tidak ditemukan. Silakan masuk kembali." }, { status: 401 });

          const body = await request.json().catch(() => null) as { plan?: unknown } | null;
          if (!isDuitkuPlanCode(body?.plan)) return Response.json({ error: "Paket tidak valid." }, { status: 400 });

          const planCode = body.plan;
          const plan = DUITKU_PLANS[planCode];
          const { merchantCode, apiKey } = duitkuConfig();
          const admin = supabaseAdmin as any;
          const { data: profile } = await admin
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle();

          const customerName = String(profile?.display_name || user.user_metadata?.full_name || user.email || "Pengguna ENO NIHONGO")
            .trim()
            .slice(0, 100);
          const merchantOrderId = `ENO-${Date.now()}-${randomUUID().slice(0, 8)}`;
          const { error: insertError } = await admin.from("payment_orders").insert({
            user_id: user.id,
            provider: "duitku",
            merchant_order_id: merchantOrderId,
            product_type: planCode === "lifetime" ? "lifetime" : "subscription",
            plan: planCode,
            duration_days: plan.days,
            amount_idr: plan.amount,
            currency: "IDR",
            status: "pending",
          });
          if (insertError) throw new Error(insertError.message);

          const origin = applicationOrigin();
          const timestamp = String(Date.now());
          const payload = {
            paymentAmount: plan.amount,
            merchantOrderId,
            productDetails: plan.name,
            additionalParam: "",
            merchantUserInfo: user.id,
            customerVaName: customerName,
            email: user.email || "support@enonihongo.com",
            phoneNumber: "",
            itemDetails: [{ name: plan.name, price: plan.amount, quantity: 1 }],
            callbackUrl: `${origin}/pembayaran/duitku/callback`,
            returnUrl: `${origin}/pembayaran/duitku/selesai?order=${encodeURIComponent(merchantOrderId)}`,
            expiryPeriod: 60,
          };
          const duitkuResponse = await fetch("https://api-sandbox.duitku.com/api/merchant/createInvoice", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-duitku-timestamp": timestamp,
              "x-duitku-merchantcode": merchantCode,
              "x-duitku-signature": createInvoiceSignature(merchantCode, timestamp, apiKey),
            },
            body: JSON.stringify(payload),
          });
          const result = await duitkuResponse.json().catch(() => ({})) as Record<string, unknown>;
          if (!duitkuResponse.ok || result.statusCode !== "00" || typeof result.paymentUrl !== "string" || typeof result.reference !== "string") {
            await admin.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("merchant_order_id", merchantOrderId);
            throw new Error(String(result.statusMessage || "Duitku belum dapat membuat tagihan. Coba lagi."));
          }

          await admin.from("payment_orders").update({
            provider_reference: result.reference,
            updated_at: new Date().toISOString(),
          }).eq("merchant_order_id", merchantOrderId);

          return Response.json({ paymentUrl: result.paymentUrl, merchantOrderId });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Gagal membuat tagihan Duitku." }, { status: 502 });
        }
      },
    },
  },
});
