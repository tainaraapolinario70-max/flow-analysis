import { env } from "cloudflare:workers";
import { ensureDatabaseSchema } from "../../../db/ensure-schema";

type E = { DB: D1Database };
const headers = { "cache-control": "no-store, no-cache, must-revalidate" };
const defaults = {
  appName: "Análise de Fluxo",
  subtitle: "Inteligência escolar",
  kicker: "ANÁLISE DE FLUXO",
  primaryColor: "#287f6a",
  sidebarColor: "#203f37",
  backgroundColor: "#cbdad4",
  dashboardTitle: "Visão geral",
  dashboardDescription: "Indicadores, equipamentos e pendências organizados.",
};

export async function GET() {
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  const row = await db.prepare("SELECT payload FROM app_settings WHERE id=1").first<{payload:string}>();
  const stored = row ? JSON.parse(row.payload) : {};
  if (["#e2ece7", "#dde8e3", "#edf3f0"].includes(stored.backgroundColor)) stored.backgroundColor = defaults.backgroundColor;
  return Response.json({ ...defaults, ...stored }, { headers });
}

export async function PUT(request: Request) {
  const incoming = await request.json() as Record<string, unknown>;
  const saved = { ...defaults, ...incoming };
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  await db.prepare(`INSERT INTO app_settings (id,payload,updated_at) VALUES (1,?,?)
    ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
    .bind(JSON.stringify(saved), new Date().toISOString()).run();
  return Response.json(saved, { headers });
}
