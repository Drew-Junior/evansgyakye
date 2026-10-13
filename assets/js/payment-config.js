/*
  Paystack public key. This is safe to expose in client-side code (like
  the Supabase anon key) -- it can only ever initiate a checkout, never
  move money or read account data. Replace the placeholder below with
  your real Paystack public key from Settings -> API Keys & Webhooks in
  your Paystack dashboard. Use a pk_test_... key while testing, and
  switch to your pk_live_... key only once you're ready to accept real
  payments.
*/
window.PAYSTACK_PUBLIC_KEY = "pk_live_8ee618662e9467d58d9647ecca7bbe804f2614d9";
