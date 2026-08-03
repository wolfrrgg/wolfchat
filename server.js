import express from "express";
import http from "http";
import crypto from "crypto";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();

app.use(express.static("public"));

function room(id) {
  if (!rooms.has(id)) rooms.set(id, { clients: new Set(), messages: new Map() });
  return rooms.get(id);
}

function broadcast(r, payload) {
  const data = JSON.stringify(payload);
  for (const ws of r.clients) if (ws.readyState === 1) ws.send(data);
}

wss.on("connection", ws => {
  let current = null;
  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === "join") {
      const id = String(m.room || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
      if (!id) return;
      const r = room(id);
      if (r.clients.size >= 2) {
        ws.send(JSON.stringify({ type: "error", message: "Ruang ini sudah penuh (maksimal 2 orang)." }));
        return;
      }
      current = id;
      r.clients.add(ws);
      ws.room = id;
      ws.send(JSON.stringify({ type: "joined", count: r.clients.size }));
      broadcast(r, { type: "presence", count: r.clients.size });
      return;
    }

    if (!current) return;
    const r = rooms.get(current);
    if (!r) return;

    if (m.type === "message") {
      const id = crypto.randomUUID();
      const ttl = Math.max(0, Math.min(Number(m.ttl || 3600), 604800));
      const msg = { ...m, id, ttl, createdAt: Date.now() };
      delete msg.type;
      r.messages.set(id, msg);
      broadcast(r, { type: "message", ...msg });
      if (ttl > 0) setTimeout(() => {
        if (r.messages.delete(id)) broadcast(r, { type: "deleted", id });
      }, ttl * 1000);
    }

    if (m.type === "delete_all") {
      r.messages.clear();
      broadcast(r, { type: "delete_all" });
    }

    if (m.type === "typing") broadcast(r, { type: "typing", value: !!m.value });
  });

  ws.on("close", () => {
    if (!current) return;
    const r = rooms.get(current);
    if (!r) return;
    r.clients.delete(ws);
    broadcast(r, { type: "presence", count: r.clients.size });
    if (!r.clients.size) rooms.delete(current);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`WolfChat running on http://localhost:${PORT}`));