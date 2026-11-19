// =====================================================================
//  Envoi des notifications du planning Cha'Mania (lancé par GitHub Actions)
//  1. Crée le rappel "N'oublie pas de me poster" (10 min avant l'heure prévue)
//  2. Le lundi matin, crée le récap de la semaine pour chacune
//  3. Envoie sur les téléphones toutes les notifications en attente
// =====================================================================
import fs from "node:fs";
import webpush from "web-push";

const cfg = fs.readFileSync("config.js", "utf8");
const pick = k => (cfg.match(new RegExp(k + String.raw`:\s*"([^"]*)"`)) || [])[1] || "";
const URL_ = (pick("SUPABASE_URL").match(/^(https?:\/\/[^\/?#]+)/i) || [])[1];
const VAPID_PUBLIC = pick("VAPID_PUBLIC_KEY");
const KEY = (process.env.SUPABASE_SECRET_KEY || "").trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY || "").trim();

const [owner, repo] = (process.env.GITHUB_REPOSITORY || "/").split("/");
const APP_URL = (process.env.APP_URL || (repo && repo.toLowerCase() === `${owner}.github.io`.toLowerCase()
  ? `https://${owner.toLowerCase()}.github.io/`
  : `https://${(owner || "").toLowerCase()}.github.io/${repo}/`)).replace(/\/?$/, "/");

const missing = [!URL_ && "SUPABASE_URL (config.js)", !VAPID_PUBLIC && "VAPID_PUBLIC_KEY (config.js)", !KEY && "secret SUPABASE_SECRET_KEY", !VAPID_PRIVATE && "secret VAPID_PRIVATE_KEY"].filter(Boolean);
if (missing.length) { console.error("❌ Il manque : " + missing.join(", ")); process.exit(1); }

webpush.setVapidDetails(APP_URL.replace(/\/$/, ""), VAPID_PUBLIC, VAPID_PRIVATE);

const headers = { apikey: KEY, "Content-Type": "application/json", Prefer: "return=representation" };
if (!KEY.startsWith("sb_")) headers.Authorization = "Bearer " + KEY; // ancienne clé service_role
async function api(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${opts.method || "GET"} ${path.split("?")[0]} → ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

// --- Heure de Paris -> instant UTC
function parisToUtc(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "10:00").slice(0, 5).split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const asParis = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asParis - guess));
}
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const PFL = { instagram: "Instagram", facebook: "Facebook" };
function quand(dateStr, timeStr, now) {
  const todayParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const [y, m, d] = dateStr.split("-").map(Number);
  const jour = dateStr === todayParis ? "aujourd'hui" : `${JOURS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MOIS[m - 1]}`;
  return jour + (timeStr ? " à " + timeStr.slice(0, 5).replace(":", "h") : "");
}

const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
let created = 0, sent = 0, failed = 0, cleaned = 0;

// ---------- 1. Rappels ----------
const posts = await api("posts?select=id,title,date,time,assignee,platforms,published,reminder_sent_at,late_sent_at&status=eq.pret&date=not.is.null&assignee=not.is.null");
for (const p of posts) {
  const todo = (p.platforms || []).filter(k => !(p.published || {})[k]);
  if (!todo.length) continue;
  const due = parisToUtc(p.date, p.time);
  const diffMin = (now - due) / 60000;
  const where = todo.map(k => PFL[k] || k).join(" et ");
  // Une seule notification, 10 minutes avant l'heure prévue
  if (!p.reminder_sent_at && diffMin >= -12 && diffMin < 30) {
    await api("notifications", { method: "POST", body: JSON.stringify({ membre_id: p.assignee, post_id: p.id, kind: "rappel",
      title: "⏰ N'oublie pas de me poster !", body: `« ${p.title} » est prévu ${quand(p.date, p.time, now)} sur ${where}.` }) });
    await api(`posts?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ reminder_sent_at: now.toISOString() }) });
    created++;
  }
}

// ---------- 1 bis. Récap du lundi matin (une fois par semaine, après 8 h) ----------
const parisNow = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
const todayParis = `${parisNow.year}-${parisNow.month}-${parisNow.day}`;
if (parisNow.weekday === "Mon" && +parisNow.hour >= 8) {
  const reg = (await api("reglages?select=dernier_recap,objectif_semaine&id=eq.1").catch(() => []))[0];
  if (reg && reg.dernier_recap !== todayParis) {
    const sunday = new Date(Date.UTC(+parisNow.year, +parisNow.month - 1, +parisNow.day + 6)).toISOString().slice(0, 10);
    const week = await api(`posts?select=id,status,visual_by,wording_by,assignee,visual_done_at,wording_done_at&date=gte.${todayParis}&date=lte.${sunday}`);
    const membres = await api("membres?select=id,name");
    const planned = week.filter(p => p.status !== "idee").length;
    for (const m of membres) {
      const v = week.filter(p => p.visual_by === m.id && !p.visual_done_at && ["idee", "creation"].includes(p.status)).length;
      const w = week.filter(p => p.wording_by === m.id && !p.wording_done_at && ["idee", "creation"].includes(p.status)).length;
      const a = week.filter(p => p.assignee === m.id && ["validation", "pret"].includes(p.status)).length;
      const parts = [v && `${v} visuel${v > 1 ? "s" : ""}`, w && `${w} texte${w > 1 ? "s" : ""}`, a && `${a} post${a > 1 ? "s" : ""} à publier`].filter(Boolean);
      await api("notifications", { method: "POST", body: JSON.stringify({ membre_id: m.id, kind: "recap",
        title: "🗓️ Ta semaine Cha'Mania",
        body: (parts.length ? `Pour toi : ${parts.join(", ")}. ` : "Rien de prévu pour toi cette semaine. ") + `Équipe : ${planned}/${reg.objectif_semaine || 3} posts prévus.` }) });
      created++;
    }
    await api("reglages?id=eq.1", { method: "PATCH", body: JSON.stringify({ dernier_recap: todayParis }) });
  }
}

// ---------- 2. Envoi des notifications en attente ----------
const since = new Date(now - 2 * 864e5).toISOString();
const pendingN = await api(`notifications?select=id,membre_id,post_id,title,body&sent_at=is.null&created_at=gte.${since}&order=created_at.asc&limit=200`);
const subsCache = {};
for (const n of pendingN) {
  subsCache[n.membre_id] ??= await api(`push_subscriptions?select=id,endpoint,p256dh,auth&membre_id=eq.${n.membre_id}`);
  const payload = JSON.stringify({ title: n.title, body: n.body, tag: n.id, url: APP_URL + (n.post_id ? `#post-${n.post_id}` : "#a-poster") });
  for (const s of subsCache[n.membre_id]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600, urgency: "high" });
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) { // téléphone désabonné : on l'oublie
        await api(`push_subscriptions?id=eq.${s.id}`, { method: "DELETE" });
        subsCache[n.membre_id] = subsCache[n.membre_id].filter(x => x.id !== s.id); cleaned++;
      } else console.error("Envoi impossible :", e.statusCode || "", e.body || e.message);
    }
  }
  await api(`notifications?id=eq.${n.id}`, { method: "PATCH", body: JSON.stringify({ sent_at: new Date().toISOString() }) });
}

// ---------- 3. Ménage ----------
if (now.getUTCHours() === 3 && now.getUTCMinutes() < 10) await api("rpc/cleanup_notifications", { method: "POST", body: "{}" }).catch(() => {});

console.log(`✅ ${posts.length} posts vérifiés · ${created} rappel(s) créé(s) · ${pendingN.length} notification(s) traitée(s) · ${sent} envoi(s) · ${failed} échec(s) · ${cleaned} abonnement(s) expiré(s)`);
