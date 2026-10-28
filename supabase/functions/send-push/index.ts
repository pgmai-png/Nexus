// NEXUS · send-push
// Envía una notificación push a un usuario. Solo si quien la envía tiene sesión
// y comparte grupo con el destinatario (antes bastaba con la clave pública anon).
//
// Secretos necesarios (supabase/.env.local, fuera de Git):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const TYPES = new Set(["mission_complete", "xp_overtake", "level_up"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = {
  "Access-Control-Allow-Origin": "https://pgmai-png.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
}

webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = env("SUPABASE_URL");
  const asCaller = createClient(url, env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "No autenticado" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const to = String(body.to_user_id ?? "");
  const type = String(body.type ?? "");
  const message = String(body.message ?? "").trim().slice(0, 200);
  if (!UUID.test(to) || !TYPES.has(type) || !message) return json({ error: "Datos inválidos" }, 400);
  if (to === user.id) return json({ sent: 0 });

  // shares_group() se evalúa como el usuario que llama (RLS), no como admin
  const { data: shares, error: shareErr } = await asCaller.rpc("shares_group", { u: to });
  if (shareErr) return json({ error: "No se pudo comprobar el grupo" }, 500);
  if (!shares) return json({ error: "No compartís grupo" }, 403);

  const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions").select("id, subscription").eq("user_id", to);
  if (subErr) return json({ error: "No se pudieron leer las suscripciones" }, 500);

  const payload = JSON.stringify({ title: "NEXUS", body: message, tag: type, data: { url: "/Nexus/" } });
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(s.subscription, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410: el navegador anuló la suscripción; se borra para no reintentar
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push error", code, (e as Error).message);
    }
  }
  return json({ sent });
});
