// NEXUS · daily-reminder
// La llama cada hora .github/workflows/reminders.yml. Avisa a quien eligió esta hora
// (hora de España) y aún tiene misiones diarias pendientes, con cómo va frente al grupo.
// Protegida con CRON_SECRET (no usa JWT de usuario).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
}
webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

function madridNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), period: `${parts.year}-${parts.month}` };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }
  const url = new URL(req.url);
  const now = madridNow();
  // ?hour=N solo para pruebas manuales
  const hour = url.searchParams.has("hour") ? Number(url.searchParams.get("hour")) : now.hour;
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const { data: users, error } = await db.from("profiles")
    .select("id, username, reminder_last").eq("reminder_hour", hour);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0, skipped = 0;
  for (const u of users ?? []) {
    if (u.reminder_last === now.date) { skipped++; continue; }
    // Misiones diarias pendientes hoy
    const { data: daily } = await db.from("missions").select("id, group_id")
      .eq("user_id", u.id).eq("type", "daily").not("approved_by", "is", null);
    const { data: done } = await db.from("mission_completions").select("mission_id")
      .eq("user_id", u.id).eq("completed_date", now.date);
    const doneIds = new Set((done ?? []).map((d) => d.mission_id));
    const pending = (daily ?? []).filter((m) => !doneIds.has(m.id)).length;
    await db.from("profiles").update({ reminder_last: now.date }).eq("id", u.id);
    if (!pending) { skipped++; continue; }

    // Cómo va frente al mejor rival de su grupo este mes
    let rivalTxt = "";
    const gid = daily?.[0]?.group_id;
    if (gid) {
      const { data: board } = await db.from("monthly_xp").select("user_id, xp").eq("group_id", gid).eq("period", now.period);
      const mine = board?.find((b) => b.user_id === u.id)?.xp ?? 0;
      const top = (board ?? []).filter((b) => b.user_id !== u.id).sort((a, b) => b.xp - a.xp)[0];
      if (top) {
        const { data: tp } = await db.from("profiles").select("username").eq("id", top.user_id).single();
        rivalTxt = top.xp > mine ? ` · ${tp?.username ?? "Tu rival"} va ${top.xp - mine} xp por delante`
          : ` · vas primero este mes`;
      }
    }
    const body = `Te ${pending === 1 ? "queda 1 misión" : `quedan ${pending} misiones`} hoy${rivalTxt}`;
    const { data: subs } = await db.from("push_subscriptions").select("id, subscription").eq("user_id", u.id);
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription,
          JSON.stringify({ title: "NEXUS", body, tag: "reminder", data: { url: "/Nexus/" } }), { TTL: 3 * 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return new Response(JSON.stringify({ hour, date: now.date, candidates: users?.length ?? 0, sent, skipped }),
    { headers: { "Content-Type": "application/json" } });
});
