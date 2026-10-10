// Supabase Edge Function: verify-payment
// Confirms a Paystack transaction server-side before marking an order
// paid. The Paystack SECRET key lives only here (as a Supabase secret),
// never in client-side code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ ok: false, error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ask Paystack directly whether this transaction really succeeded.
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const verifyJson = await verifyRes.json();

    const paid = verifyJson?.status === true && verifyJson?.data?.status === "success";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, total_amount, currency")
      .eq("paystack_reference", reference)
      .single();

    if (fetchError || !order) {
      return new Response(JSON.stringify({ ok: false, error: "Order not found for this reference" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Defence in depth: also check the amount Paystack confirms matches
    // what we expected (Paystack amounts are in pesewas/kobo).
    const expectedPesewas = Math.round(Number(order.total_amount) * 100);
    const amountMatches = verifyJson?.data?.amount === expectedPesewas;

    const finalStatus = paid && amountMatches ? "paid" : "failed";

    await supabase
      .from("orders")
      .update({ status: finalStatus, paid_at: finalStatus === "paid" ? new Date().toISOString() : null })
      .eq("id", order.id);

    return new Response(JSON.stringify({ ok: finalStatus === "paid", status: finalStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
