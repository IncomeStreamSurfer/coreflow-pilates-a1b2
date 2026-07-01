import type { APIRoute } from "astro";
import { anonClient } from "../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async () => {
  const sb = anonClient();
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  let body = "# Core & Flow Pilates Studio\n\nA boutique Austin pilates studio offering mat, reformer, prenatal, and barre fusion classes.\n\n---\n\n";

  if (sb) {
    const [{ data: pages }, { data: classes }, { data: instructors }] = await Promise.all([
      sb.from("pages").select("title, body_html").not("published_at", "is", null),
      sb.from("classes").select("name, short_description, body_html").not("published_at", "is", null).order("sort_order"),
      sb.from("instructors").select("name, role, bio").not("published_at", "is", null).order("sort_order"),
    ]);

    for (const p of pages ?? []) {
      body += `# ${p.title}\n\n${stripHtml(p.body_html ?? "")}\n\n---\n\n`;
    }
    for (const c of classes ?? []) {
      body += `# ${c.name}\n\n${c.short_description ?? ""}\n\n${stripHtml(c.body_html ?? "")}\n\n---\n\n`;
    }
    for (const i of instructors ?? []) {
      body += `# ${i.name} (${i.role})\n\n${i.bio ?? ""}\n\n---\n\n`;
    }
  }

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
