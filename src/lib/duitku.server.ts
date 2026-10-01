import { createHmac, timingSafeEqual } from "node:crypto";

export const DUITKU_PLANS = {
  premium_monthly: { name: "Premium Bulanan ENO NIHONGO", amount: 50_000, days: 30 },
  premium_yearly: { name: "Premium Tahunan ENO NIHONGO", amount: 350_000, days: 365 },
  lifetime: { name: "Lifetime ENO NIHONGO", amount: 1_500_000, days: null },
} as const;

export type DuitkuPlanCode = keyof typeof DUITKU_PLANS;

export function isDuitkuPlanCode(value: unknown): value is DuitkuPlanCode {
  return typeof value === "string" && value in DUITKU_PLANS;
}

export function duitkuConfig() {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE;
  const apiKey = process.env.DUITKU_API_KEY;
  if (!merchantCode || !apiKey) throw new Error("Konfigurasi Duitku belum lengkap.");
  return { merchantCode, apiKey };
}

export function createInvoiceSignature(merchantCode: string, timestamp: string, apiKey: string) {
  return createHmac("sha256", apiKey).update(`${merchantCode}${timestamp}`).digest("hex");
}

export function createCallbackSignature(merchantCode: string, amount: string, merchantOrderId: string, apiKey: string) {
  return createHmac("sha256", apiKey).update(`${merchantCode}${amount}${merchantOrderId}`).digest("hex");
}

export function isValidCallbackSignature(expected: string, received: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export function applicationOrigin() {
  return (process.env.APP_URL || "https://enonihongo.com").replace(/\/$/, "");
}
