import type { APIRoute } from "astro";
import { anonClient } from "../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async () => {
  const SITE = (import.meta.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const sb = anonClient();

  const lines: string[] = [];
  lines.push(`# Core & Flow Pilates Studio`);
  lines.push("");
  lines.push(`> A boutique Austin pilates studio offering mat, reformer, prenatal, and barre fusion classes with online scheduling and secure Stripe booking.`);
  lines.push("");
  lines.push("## Key pages");
  lines.push("");

  const staticPages = [
    { slug: "", title: "Home", desc: "Overview of Core & Flow Pilates Studio in Austin, TX." },
    { slug: "classes", title: "Classes", desc: "Overview of mat, reformer, prenatal, barre fusion, and private pilates classes." },
    { slug: "classes/mat-pilates", title: "Mat Pilates", desc: "Mat pilates class details, pricing, and booking." },
    { slug: "classes/reformer-pilates", title: "Reformer Pilates", desc: "Reformer pilates class details, pricing, and booking." },
    { slug: "classes/prenatal-pilates", title: "Prenatal Pilates", desc: "Prenatal pilates class details, pricing, and booking." },
    { slug: "classes/barre-fusion", title: "Barre Fusion", desc: "Barre fusion class details, pricing, and booking." },
    { slug: "classes/private-sessions", title: "Private Sessions", desc: "One-on-one private pilates session details and booking." },
    { slug: "schedule", title: "Weekly Schedule", desc: "Live weekly class schedule with real-time availability." },
    { slug: "instructors", title: "Instructors", desc: "Meet the certified pilates instructors at Core & Flow Studio." },
    { slug: "pricing", title: "Pricing", desc: "Drop-in rates and class packages." },
    { slug: "testimonials", title: "Testimonials", desc: "What members say about Core & Flow Pilates Studio." },
    { slug: "about", title: "About", desc: "The story behind Core & Flow Pilates Studio." },
    { slug: "faq", title: "FAQ", desc: "Answers to common questions about booking and classes." },
    { slug: "contact", title: "Contact", desc: "Get in touch with the studio." },
    { slug: "book", title: "Book a Class", desc: "Reserve and pay for a pilates class online." },
  ];

  for (const p of staticPages) {
    lines.push(`- [${p.title}](${SITE}/${p.slug}): ${p.desc}`);
  }

  if (sb) {
    const { data: instructors } = await sb
      .from("instructors")
      .select("slug, name, role")
      .not("published_at", "is", null)
      .order("sort_order");
    if (instructors && instructors.length > 0) {
      lines.push("");
      lines.push("## Instructors");
      lines.push("");
      for (const i of instructors) {
        lines.push(`- [${i.name}](${SITE}/instructors/${i.slug}): ${i.role}`);
      }
    }
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
