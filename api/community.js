// Vercel Serverless Function — maneja el feed de la comunidad, la lista de
// usuarios públicos y las "alacenas públicas" usando Upstash Redis (gratis).
//
// Esta función es OPCIONAL: si no configuras UPSTASH_REDIS_REST_URL y
// UPSTASH_REDIS_REST_TOKEN, la app sigue funcionando perfecto para uso
// personal (alacena, diario, recomendaciones) — solo la pestaña Comunidad
// mostrará un aviso de que no está configurada.
//
// Cómo obtenerlas (gratis): crea una cuenta en https://upstash.com,
// crea una base de datos Redis, y copia "REST URL" y "REST TOKEN" a tus
// variables de entorno en Vercel.

import { Redis } from "@upstash/redis";

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parseMaybeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

export default async function handler(req, res) {
  const redis = getRedis();

  if (req.method === "GET") {
    const { action, username } = req.query;

    if (!redis) {
      if (action === "feed") return res.status(200).json({ posts: [], configured: false });
      if (action === "users") return res.status(200).json({ users: [], configured: false });
      if (action === "pantry") return res.status(200).json({ items: [], configured: false });
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    try {
      if (action === "feed") {
        const raw = (await redis.lrange("community:feed", 0, 29)) || [];
        const posts = raw.map((r) => parseMaybeJSON(r, null)).filter(Boolean);
        res.status(200).json({ posts, configured: true });
        return;
      }
      if (action === "users") {
        const raw = await redis.get("community:users");
        const users = parseMaybeJSON(raw, []);
        res.status(200).json({ users, configured: true });
        return;
      }
      if (action === "pantry" && username) {
        const raw = await redis.get(`community:pantry:${username}`);
        const items = parseMaybeJSON(raw, []);
        res.status(200).json({ items, configured: true });
        return;
      }
      res.status(400).json({ error: "Parámetros inválidos" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    if (!redis) {
      res.status(200).json({ ok: false, configured: false });
      return;
    }

    try {
      const { action } = req.query;
      const body = req.body || {};

      if (action === "post") {
        await redis.lpush("community:feed", JSON.stringify(body));
        await redis.ltrim("community:feed", 0, 199);
        res.status(200).json({ ok: true });
        return;
      }

      if (action === "pantry") {
        const { username, items } = body;
        if (!username) {
          res.status(400).json({ error: "Falta el nombre de usuario." });
          return;
        }
        await redis.set(`community:pantry:${username}`, JSON.stringify(items || []));
        res.status(200).json({ ok: true });
        return;
      }

      if (action === "upsert-user") {
        const { username, sharePantry, shareMeals } = body;
        if (!username) {
          res.status(400).json({ error: "Falta el nombre de usuario." });
          return;
        }
        const raw = await redis.get("community:users");
        const list = parseMaybeJSON(raw, []);
        const filtered = (Array.isArray(list) ? list : []).filter((u) => u.username !== username);
        filtered.push({ username, sharePantry: !!sharePantry, shareMeals: !!shareMeals, updatedAt: Date.now() });
        await redis.set("community:users", JSON.stringify(filtered));
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: "Acción inválida" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}
