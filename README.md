# NEXUS

PWA para competir con amigos cumpliendo misiones diarias, semanales y mensuales: XP, niveles, rachas, logros, ranking mensual del grupo y ruleta de castigos.

**Web:** https://pgmai-png.github.io/Nexus/ (GitHub Pages desde `main`).

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de pantallas y modales |
| `styles.css` | Estilos (tokens de color en `:root`) |
| `app.js` | Lógica del cliente; habla con Supabase por REST (`db()`) y RPC (`rpc()`) |
| `sw.js` | Service worker: recibe y muestra notificaciones push |
| `manifest.json`, `icon-*.png` | Instalación como app |
| `supabase/migrations/` | Esquema de seguridad: políticas RLS y funciones de juego |
| `supabase/functions/send-push/` | Edge Function que envía las notificaciones push |
| `.github/workflows/keepalive.yml` | Ping cada 3 días para que Supabase (plan gratuito) no pause el proyecto |

## Backend (Supabase)

Proyecto `wusqkenwwxaglpifrhtf`. La clave `anon` de `app.js` es pública por diseño: la seguridad la ponen las políticas RLS.

El navegador **no** escribe XP, rachas ni el marcador: lo hacen funciones de servidor (`complete_mission`, `uncomplete_mission`, `delete_mission`, `close_month`, `join_group_by_code`, `award_custom_achievement`). Ver `supabase/migrations/001_seguridad.sql`.

### Aplicar una migración

Pegar el `.sql` en *SQL Editor* → **Run**. Va en una transacción: o se aplica entero o nada.

### Desplegar `send-push`

Los secretos VAPID están en `supabase/.env.local` (ignorado por Git, **no subir nunca**).

```bash
supabase secrets set --env-file supabase/.env.local --project-ref wusqkenwwxaglpifrhtf
supabase functions deploy send-push --project-ref wusqkenwwxaglpifrhtf
```

Si se cambian las claves VAPID, actualizar también `VAPID_PUB` en `app.js`; los usuarios se resuscriben solos al abrir la app.

## Desarrollo local

Es estático: basta un servidor en la carpeta padre para respetar la ruta `/Nexus/`:

```bash
python -m http.server 8000
```

y abrir http://localhost:8000/Nexus/
