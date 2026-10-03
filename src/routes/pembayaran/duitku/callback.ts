import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createCallbackSignature,
  duitkuConfig,
  isDuitkuPlanCode,
  isValidCallbackSignature,
} from "@/lib/duitku.server";

type FinalizeDuitkuArgs = {
  p_merchant_order_id: string;
  p_provider_reference: string | null;
  p_payment_method: string | null;
  p_event_key: string;
  p_payload: Record<string, string>;
};

export const Route = createFileRoute("/pembayaran/duitku/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const merchantCode = String(form.get("merchantCode") || "");
          const amount = String(form.get("amount") || "");
          const merchantOrderId = String(form.get("merchantOrderId") || "");
          const signature = String(form.get("signature") || "");
          const resultCode = String(form.get("resultCode") || "");
          const reference = String(form.get("reference") || "");
          const paymentCode = String(form.get("paymentCode") || "");
          const { merchantCode: expectedMerchantCode, apiKey } = duitkuConfig();

          if (!merchantOrderId || merchantCode !== expectedMerchantCode || !amount || !signature) {
            return new Response("Invalid payment callback", { status: 400 });
          }
          const expectedSignature = createCallbackSignature(
            merchantCode,
            amount,
            merchantOrderId,
            apiKey,
          );
          if (!isValidCallbackSignature(expectedSignature, signature)) {
            return new Response("Invalid payment callback signature", { status: 401 });
          }

          const admin = supabaseAdmin;
          const { data: order, error: orderError } = await admin
            .from("payment_orders")
            .select("id,plan,amount_idr,status")
            .eq("merchant_order_id", merchantOrderId)
            .maybeSingle();
          if (orderError) throw new Error(orderError.message);
          if (
            !order ||
            Number(order.amount_idr) !== Number(amount) ||
            !isDuitkuPlanCode(order.plan)
          ) {
            return new Response("Payment order not found", { status: 404 });
          }

          // Callback Duitku berupa form urlencoded, jadi semua nilai bertipe string.
          const callbackPayload = Object.fromEntries(form.entries()) as Record<string, string>;
          if (resultCode !== "00") {
            const eventKey = `${merchantOrderId}:${resultCode}:${reference || "none"}`;
            await admin.from("payment_webhook_events").upsert(
              {
                provider: "duitku",
                event_key: eventKey,
                merchant_order_id: merchantOrderId,
                status: "received",
                payload: callbackPayload,
              },
              { onConflict: "provider,event_key" },
            );
            await admin
              .from("payment_orders")
              .update({
                status: resultCode === "01" ? "failed" : "cancelled",
                provider_reference: reference || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", order.id)
              .neq("status", "paid");
            return new Response("OK", { status: 200 });
          }

          const eventKey = `${merchantOrderId}:00:${reference || "paid"}`;
          // Argumen referensi/metode boleh null di fungsi database; tipe generated menyebutnya string.
          const { error: finalizeError } = await (
            admin as unknown as {
              rpc(
                name: "finalize_duitku_payment",
                args: FinalizeDuitkuArgs,
              ): PromiseLike<{ error: { message: string } | null }>;
            }
          ).rpc("finalize_duitku_payment", {
            p_merchant_order_id: merchantOrderId,
            p_provider_reference: reference || null,
            p_payment_method: paymentCode || null,
            p_event_key: eventKey,
            p_payload: callbackPayload,
          });
          if (finalizeError) throw new Error(finalizeError.message);
          return new Response("OK", { status: 200 });
        } catch (error) {
          console.error("Duitku callback failed", error);
          return new Response("Callback processing failed", { status: 500 });
        }
      },
    },
  },
});
