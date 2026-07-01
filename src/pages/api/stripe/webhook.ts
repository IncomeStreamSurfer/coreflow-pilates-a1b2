import type { APIRoute } from "astro";
import { stripe } from "../../../lib/stripe";
import { anonClient } from "../../../lib/supabase";
import { sendBookingConfirmation } from "../../../lib/email";

export const prerender = false;

const WEBHOOK_SECRET = import.meta.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("no sig", { status: 400 });

  const rawBody = await request.text();
  let event: any;
  try {
    event = await stripe().webhooks.constructEventAsync(rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    return new Response(`invalid sig: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const meta = s.metadata ?? {};
    const sb = anonClient();

    if (sb && meta.class_session_id) {
      const spots = parseInt(meta.spots ?? "1", 10) || 1;

      const { data: bookingId, error } = await sb.rpc("confirm_booking", {
        p_class_session_id: meta.class_session_id,
        p_customer_name: meta.customer_name ?? s.customer_details?.name ?? "",
        p_customer_email: meta.customer_email ?? s.customer_details?.email ?? s.customer_email ?? "",
        p_customer_phone: meta.customer_phone ?? "",
        p_spots: spots,
        p_amount_paid_cents: s.amount_total ?? 0,
        p_currency: s.currency ?? "usd",
        p_stripe_session_id: s.id,
      });

      if (!error && bookingId && meta.customer_email) {
        const startTimeLabel = meta.start_time
          ? new Date(meta.start_time).toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/Chicago",
            })
          : "";

        await sendBookingConfirmation({
          to: meta.customer_email,
          className: meta.class_name ?? "your class",
          instructorName: meta.instructor_name ?? "your instructor",
          startTime: startTimeLabel,
          location: meta.location ?? "South Congress Studio",
          amount: ((s.amount_total ?? 0) / 100).toFixed(2),
          currency: (s.currency ?? "usd").toUpperCase(),
          spots,
        }).catch(() => {});
      }
    }
  }

  return new Response("ok", { status: 200 });
};
