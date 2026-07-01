import type { APIRoute } from "astro";
import { stripe } from "../../lib/stripe";
import { anonClient } from "../../lib/supabase";
import { hitOrReject } from "../../lib/rate-limit";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const rl = hitOrReject(ip);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec), "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // honeypot — pretend success
  if (body.website) {
    return new Response(JSON.stringify({ url: "/checkout/success" }), { status: 200 });
  }

  const sessionId = String(body.session_id ?? "").trim();
  const customerName = String(body.customer_name ?? "").trim();
  const customerEmail = String(body.customer_email ?? "").trim().toLowerCase();
  const customerPhone = String(body.customer_phone ?? "").trim();
  const spots = Math.max(1, Math.min(4, parseInt(String(body.spots ?? "1"), 10) || 1));

  if (!sessionId || !customerName || !customerEmail) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
  }

  const sb = anonClient();
  if (!sb) {
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });
  }

  const { data: session, error } = await sb
    .from("class_sessions")
    .select("id, start_time, end_time, capacity, spots_booked, location, classes(name, slug, price_cents, currency), instructors(name)")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return new Response(JSON.stringify({ error: "Class session not found" }), { status: 404 });
  }

  const spotsLeft = session.capacity - session.spots_booked;
  if (spotsLeft < spots) {
    return new Response(JSON.stringify({ error: "Not enough spots left in this class" }), { status: 400 });
  }

  const cls: any = Array.isArray(session.classes) ? session.classes[0] : session.classes;
  const instructor: any = Array.isArray(session.instructors) ? session.instructors[0] : session.instructors;
  if (!cls) {
    return new Response(JSON.stringify({ error: "Class not found" }), { status: 404 });
  }

  const origin =
    import.meta.env.PUBLIC_SITE_URL ??
    `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host")}`;

  const startTimeLabel = new Date(session.start_time).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });

  const checkoutSession = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        quantity: spots,
        price_data: {
          currency: (cls.currency ?? "usd").toLowerCase(),
          unit_amount: cls.price_cents,
          product_data: {
            name: `${cls.name} — ${startTimeLabel}`,
            description: `With ${instructor?.name ?? "your instructor"} at ${session.location}`,
          },
        },
      },
    ],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    metadata: {
      class_session_id: session.id,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      spots: String(spots),
      class_name: cls.name,
      instructor_name: instructor?.name ?? "",
      start_time: session.start_time,
      location: session.location,
    },
  });

  return new Response(JSON.stringify({ url: checkoutSession.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
