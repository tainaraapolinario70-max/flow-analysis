import { env } from "cloudflare:workers";

type E = { DB: D1Database };
type ValidationRecord = {
  validationSchoolId: number;
  schoolName: string;
  status: string;
  payload: Record<string, unknown>;
  updatedAt?: string;
};
const headers = { "cache-control": "no-store, no-cache, must-revalidate" };

export async function GET() {
  const db = (env as E).DB;
  const result = await db
    .prepare(
      "SELECT validation_school_id,school_name,status,payload,updated_at FROM validation_records ORDER BY school_name",
    )
    .all<{
      validation_school_id: number;
      school_name: string;
      status: string;
      payload: string;
      updated_at: string;
    }>();
  return Response.json(
    result.results.map((row) => ({
      validationSchoolId: row.validation_school_id,
      schoolName: row.school_name,
      status: row.status,
      payload: JSON.parse(row.payload),
      updatedAt: row.updated_at,
    })),
    { headers },
  );
}

export async function PUT(request: Request) {
  const record = (await request.json()) as ValidationRecord;
  if (
    !Number.isInteger(record.validationSchoolId) ||
    record.validationSchoolId <= 0 ||
    !record.schoolName?.trim()
  )
    return Response.json(
      { error: "Validação inválida" },
      { status: 400, headers },
    );
  const saved = {
    ...record,
    schoolName: record.schoolName.trim(),
    status: record.status || "Em andamento",
    updatedAt: new Date().toISOString(),
  };
  const db = (env as E).DB;
  await db
    .prepare(
      `INSERT INTO validation_records (validation_school_id,school_name,status,payload,updated_at) VALUES (?,?,?,?,?)
 ON CONFLICT(validation_school_id) DO UPDATE SET school_name=excluded.school_name,status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at`,
    )
    .bind(
      saved.validationSchoolId,
      saved.schoolName,
      saved.status,
      JSON.stringify(saved.payload || {}),
      saved.updatedAt,
    )
    .run();
  return Response.json(saved, { headers });
}
