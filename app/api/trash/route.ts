import { env } from "cloudflare:workers";
import { ensureDatabaseSchema } from "../../../db/ensure-schema";

type E = { DB: D1Database };
type TrashRow = {
  id: number;
  entityType: "school" | "observation";
  entityId: string;
  title: string;
  payload: string;
  deletedAt: string;
};
const headers = {
  "cache-control": "no-store, no-cache, must-revalidate",
  pragma: "no-cache",
  expires: "0",
};

export async function GET() {
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  const result = await db
    .prepare(
      "SELECT id,entity_type entityType,entity_id entityId,title,payload,deleted_at deletedAt FROM deleted_items ORDER BY deleted_at DESC,id DESC",
    )
    .all<TrashRow>();
  return Response.json(
    result.results.map(({ payload: _payload, ...item }) => item),
    { headers },
  );
}

export async function POST(request: Request) {
  const id = Number((await request.json() as { id?: number }).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "Item inválido" }, { status: 400, headers });
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  const item = await db
    .prepare(
      "SELECT id,entity_type entityType,entity_id entityId,title,payload,deleted_at deletedAt FROM deleted_items WHERE id=?",
    )
    .bind(id)
    .first<TrashRow>();
  if (!item)
    return Response.json({ error: "Item não encontrado" }, { status: 404, headers });

  const data = JSON.parse(item.payload);
  const statements: D1PreparedStatement[] = [];
  if (item.entityType === "school") {
    const school = data.school;
    if (!school?.id || !school?.school)
      return Response.json({ error: "Arquivo da unidade inválido" }, { status: 422, headers });
    statements.push(
      db.prepare(
        "INSERT INTO schools (school_id,school_name,payload,updated_at) VALUES (?,?,?,?) ON CONFLICT(school_id) DO UPDATE SET school_name=excluded.school_name,payload=excluded.payload,updated_at=excluded.updated_at",
      ).bind(school.id, school.school, JSON.stringify(school), new Date().toISOString()),
    );
    for (const record of data.records || [])
      statements.push(
        db.prepare(
          "INSERT OR REPLACE INTO daily_records (id,school_id,school_name,record_date,category,description,responsible,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ).bind(record.id,record.schoolId,record.schoolName,record.date,record.category,record.description,record.responsible || "",record.status,record.createdAt),
      );
    for (const update of data.updates || [])
      statements.push(
        db.prepare(
          "INSERT OR REPLACE INTO school_updates (id,school_id,school_name,type,content,created_at) VALUES (?,?,?,?,?,?)",
        ).bind(update.id,update.schoolId,update.schoolName,update.type,update.content,update.createdAt),
      );
    for (const access of data.accesses || [])
      statements.push(
        db.prepare(
          "INSERT OR REPLACE INTO school_accesses (id,school_id,school_name,created_at) VALUES (?,?,?,?)",
        ).bind(access.id,access.schoolId,access.schoolName,access.createdAt),
      );
  } else if (item.entityType === "observation") {
    statements.push(
      db.prepare(
        "INSERT OR REPLACE INTO daily_records (id,school_id,school_name,record_date,category,description,responsible,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      ).bind(data.id,data.schoolId,data.schoolName,data.date,data.category,data.description,data.responsible || "",data.status,data.createdAt),
    );
  } else {
    return Response.json({ error: "Tipo não suportado" }, { status: 422, headers });
  }
  statements.push(db.prepare("DELETE FROM deleted_items WHERE id=?").bind(id));
  await db.batch(statements);
  return Response.json({ ok: true, entityType: item.entityType }, { headers });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "Item inválido" }, { status: 400, headers });
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  const result = await db.prepare("DELETE FROM deleted_items WHERE id=?").bind(id).run();
  if (!result.meta.changes)
    return Response.json({ error: "Item não encontrado" }, { status: 404, headers });
  return Response.json({ ok: true }, { headers });
}
