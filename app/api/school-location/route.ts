import { env } from "cloudflare:workers";
import { ensureDatabaseSchema } from "../../../db/ensure-schema";

type E = { DB: D1Database };
const headers = { "cache-control": "no-store, no-cache, must-revalidate" };
const allowedFields = [
  "address",
  "neighborhood",
  "locationType",
  "latitude",
  "longitude",
  "mapStatus",
  "locationAccuracy",
  "geocodeLabel",
  "googleMapsUrl",
] as const;

export async function PUT(request: Request) {
  const input = (await request.json()) as Record<string, unknown>;
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "Unidade inválida." }, { status: 400, headers });

  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  const row = await db
    .prepare("SELECT school_name, payload FROM schools WHERE school_id=?")
    .bind(id)
    .first<{ school_name: string; payload: string }>();
  if (!row)
    return Response.json({ error: "Unidade não encontrada." }, { status: 404, headers });

  const school = JSON.parse(row.payload) as Record<string, unknown>;
  for (const field of allowedFields)
    if (Object.prototype.hasOwnProperty.call(input, field)) school[field] = input[field];

  const latitude = school.latitude == null ? undefined : Number(school.latitude);
  const longitude = school.longitude == null ? undefined : Number(school.longitude);
  if (
    (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  )
    return Response.json({ error: "Latitude ou longitude inválida." }, { status: 400, headers });

  const now = new Date().toISOString();
  school.updatedAt = now;
  await db
    .prepare("UPDATE schools SET payload=?, updated_at=? WHERE school_id=?")
    .bind(JSON.stringify(school), now, id)
    .run();

  return Response.json(school, { headers });
}
