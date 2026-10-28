// Función mínima de diagnóstico: si esta tampoco responde, el fallo es de la
// plataforma (Edge Functions del proyecto) y no del código de send-push.
// Borrar cuando ya no haga falta: supabase functions delete ping
Deno.serve(() => new Response(JSON.stringify({ ok: true, at: new Date().toISOString() }), {
  headers: { "Content-Type": "application/json" },
}));
