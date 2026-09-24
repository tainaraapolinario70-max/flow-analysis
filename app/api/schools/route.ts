import { env } from "cloudflare:workers";
import baseSchools from "@/data/schools.json";
import baseProviders from "@/data/providers.json";
import schoolLocations from "@/data/school-locations.json";
import internetInstallationAddresses from "@/data/internet-installation-addresses.json";
import { ensureDatabaseSchema } from "../../../db/ensure-schema";

type E = { DB: D1Database };
type School = { id: number; school: string; providers?: string[]; [key: string]: unknown };
const headers = { "cache-control": "no-store, no-cache, must-revalidate" };
const dataVersion = "relatorio-escolas-2026-09-22-8";
const locationDataVersion = "enderecos-feira-coordenadas-2026-09-23-2";
const internetAddressVersion = "enderecos-instalacoes-internet-2026-09-23-1";

type LocationRow = {
  type: string;
  neighborhood: string;
  school: string;
  address: string;
  account: string;
  sourceStatus: string;
  sourceName: string;
  latitude?: number;
  longitude?: number;
  mapStatus?: string;
  locationAccuracy?: string;
  geocodeLabel?: string;
};

type InternetAddressRow = {
  schoolId: number;
  account: string;
  school: string;
  address: string;
  provider: string;
  sourceName: string;
  matchMethod: string;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

function seededSchools(): School[] {
  const providers = baseProviders as Record<string, string[]>;
  return (baseSchools as School[]).map((school) => ({
    ...school,
    providers: school.providers ?? providers[String(school.id)] ?? [],
  }));
}

async function seed(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_metadata WHERE key='schools_data_version'").first<{ value: string }>();
  if (version?.value !== dataVersion) {
    const now = new Date().toISOString();
    const rows = seededSchools().map((school) =>
      db.prepare(`INSERT INTO schools (school_id, school_name, payload, updated_at) VALUES (?,?,?,?)
        ON CONFLICT(school_id) DO UPDATE SET school_name=excluded.school_name,payload=excluded.payload,updated_at=excluded.updated_at`)
        .bind(school.id, school.school, JSON.stringify(school), now),
    );
    rows.push(db.prepare(`INSERT INTO app_metadata (key,value) VALUES ('schools_data_version',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(dataVersion));
    if (rows.length) await db.batch(rows);
  }

  const locationVersion = await db.prepare("SELECT value FROM app_metadata WHERE key='school_locations_version'").first<{ value: string }>();
  if (locationVersion?.value !== locationDataVersion) {
    const locations = schoolLocations as LocationRow[];
    const byName = new Map(locations.map((row) => [normalize(row.school), row]));
    const byAccount = new Map(
      locations
        .filter((row) => row.account && normalize(row.account) !== "NAO INFORMADO")
        .map((row) => [normalize(row.account), row]),
    );
    const existing = await db.prepare("SELECT school_id, school_name, payload FROM schools").all<{
      school_id: number;
      school_name: string;
      payload: string;
    }>();
    const updates = existing.results.flatMap((record) => {
      const payload = JSON.parse(record.payload) as School & Record<string, unknown>;
      const account = normalize((payload.remoteAccess as { account?: string } | undefined)?.account);
      const location = byName.get(normalize(payload.school)) || byAccount.get(account);
      if (!location) return [];
      const merged = {
        ...payload,
        address: payload.address || location.address,
        neighborhood: payload.neighborhood || location.neighborhood,
        locationType: payload.locationType || location.type,
        locationSource: payload.locationSource || location.sourceStatus,
        locationSourceName: payload.locationSourceName || location.sourceName,
        latitude: payload.latitude ?? location.latitude,
        longitude: payload.longitude ?? location.longitude,
        mapStatus: payload.mapStatus || location.mapStatus,
        locationAccuracy: payload.locationAccuracy || location.locationAccuracy,
        geocodeLabel: payload.geocodeLabel || location.geocodeLabel,
      };
      return [db.prepare("UPDATE schools SET payload=? WHERE school_id=?").bind(JSON.stringify(merged), record.school_id)];
    });
    for (let index = 0; index < updates.length; index += 50)
      await db.batch(updates.slice(index, index + 50));
    await db.prepare(`INSERT INTO app_metadata (key,value) VALUES ('school_locations_version',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(locationDataVersion).run();
  }

  const addressVersion = await db.prepare("SELECT value FROM app_metadata WHERE key='internet_addresses_version'").first<{ value: string }>();
  if (addressVersion?.value === internetAddressVersion) return;
  const addressRows = internetInstallationAddresses as InternetAddressRow[];
  const addressesByAccount = new Map(
    addressRows
      .filter((row) => row.account && normalize(row.account) !== "NAO INFORMADO")
      .map((row) => [normalize(row.account), row]),
  );
  const addressesById = new Map(addressRows.map((row) => [row.schoolId, row]));
  const existing = await db.prepare("SELECT school_id, payload FROM schools").all<{ school_id: number; payload: string }>();
  const updates = existing.results.flatMap((record) => {
    const payload = JSON.parse(record.payload) as School & Record<string, unknown>;
    const account = normalize((payload.remoteAccess as { account?: string } | undefined)?.account);
    const row = addressesByAccount.get(account) || addressesById.get(record.school_id);
    if (!row || normalize(row.school) !== normalize(payload.school)) return [];
    const currentAddress = normalize(payload.address);
    const shouldReplace = !currentAddress || currentAddress === "ENDERECO NAO CONFIRMADO" || currentAddress === "NAO INFORMADO";
    if (!shouldReplace) return [];
    const merged: School & Record<string, unknown> = {
      ...payload,
      address: row.address,
      locationSource: "Planilha de instalações de internet",
      locationSourceName: `${row.provider}: ${row.sourceName}`,
      mapStatus: "Endereço atualizado pela planilha — localizar no mapa",
      locationAccuracy: "Pendente",
    };
    if (payload.locationAccuracy !== "Confirmada") {
      delete merged.latitude;
      delete merged.longitude;
      delete merged.geocodeLabel;
    }
    return [db.prepare("UPDATE schools SET payload=?, updated_at=? WHERE school_id=?")
      .bind(JSON.stringify(merged), new Date().toISOString(), record.school_id)];
  });
  for (let index = 0; index < updates.length; index += 50)
    await db.batch(updates.slice(index, index + 50));
  await db.prepare(`INSERT INTO app_metadata (key,value) VALUES ('internet_addresses_version',?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(internetAddressVersion).run();
}

export async function GET() {
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  await seed(db);
  const result = await db.prepare("SELECT payload, updated_at FROM schools ORDER BY school_id ASC").all<{ payload: string; updated_at: string }>();
  return Response.json(result.results.map((row) => ({
    ...JSON.parse(row.payload),
    updatedAt: row.updated_at,
  })), { headers });
}

export async function PUT(request: Request) {
  const school = await request.json() as School;
  if (!Number.isInteger(school.id) || school.id <= 0 || !school.school?.trim()) {
    return Response.json({ error: "Unidade inválida" }, { status: 400, headers });
  }
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  await seed(db);
  const now = new Date().toISOString();
  const saved = { ...school, school: school.school.trim(), updatedAt: now };
  await db.prepare(`INSERT INTO schools (school_id, school_name, payload, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(school_id) DO UPDATE SET school_name=excluded.school_name,payload=excluded.payload,updated_at=excluded.updated_at`)
    .bind(saved.id, saved.school, JSON.stringify(saved), now).run();
  return Response.json(saved, { headers });
}

export async function POST(request: Request) {
  const school = await request.json() as School;
  if (!Number.isInteger(school.id) || school.id <= 0 || !school.school?.trim()) return Response.json({ error: "Unidade inválida" }, { status: 400, headers });
  const account = String((school.remoteAccess as {account?:string}|undefined)?.account ?? "").trim();
  if (!account) return Response.json({ error: "Número de Conta obrigatório" }, { status: 400, headers });
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  await seed(db);
  const duplicate = await db.prepare("SELECT school_id FROM schools WHERE json_extract(payload,'$.remoteAccess.account')=?").bind(account).first();
  if (duplicate) return Response.json({ error: "Número de Conta já cadastrado" }, { status: 409, headers });
  const now = new Date().toISOString();
  const saved = { ...school, school: school.school.trim(), updatedAt: now };
  await db.prepare("INSERT INTO schools (school_id,school_name,payload,updated_at) VALUES (?,?,?,?)").bind(saved.id,saved.school,JSON.stringify(saved),now).run();
  return Response.json(saved,{status:201,headers});
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Unidade inválida" }, { status: 400, headers });
  const db = (env as E).DB;
  await ensureDatabaseSchema(db);
  await seed(db);
  const existing = await db.prepare("SELECT school_id schoolId, school_name schoolName, payload, updated_at updatedAt FROM schools WHERE school_id=?").bind(id).first<{ schoolId:number; schoolName:string; payload:string; updatedAt:string }>();
  if (!existing) return Response.json({ error: "Unidade não encontrada" }, { status: 404, headers });
  const [records, updates, accesses] = await Promise.all([
    db.prepare("SELECT id,school_id schoolId,school_name schoolName,record_date date,category,description,responsible,status,created_at createdAt FROM daily_records WHERE school_id=?").bind(id).all(),
    db.prepare("SELECT id,school_id schoolId,school_name schoolName,type,content,created_at createdAt FROM school_updates WHERE school_id=?").bind(id).all(),
    db.prepare("SELECT id,school_id schoolId,school_name schoolName,created_at createdAt FROM school_accesses WHERE school_id=?").bind(id).all(),
  ]);
  const deletedAt = new Date().toISOString();
  const archive = JSON.stringify({
    school: JSON.parse(existing.payload),
    updatedAt: existing.updatedAt,
    records: records.results,
    updates: updates.results,
    accesses: accesses.results,
  });
  const result = await db.batch([
    db.prepare("INSERT INTO deleted_items (entity_type,entity_id,title,payload,deleted_at) VALUES (?,?,?,?,?)")
      .bind("school", String(id), existing.schoolName, archive, deletedAt),
    db.prepare("DELETE FROM daily_records WHERE school_id=?").bind(id),
    db.prepare("DELETE FROM school_updates WHERE school_id=?").bind(id),
    db.prepare("DELETE FROM school_accesses WHERE school_id=?").bind(id),
    db.prepare("DELETE FROM schools WHERE school_id=?").bind(id),
  ]);
  return Response.json({ ok: true, trashId: result[0].meta.last_row_id }, { headers });
}
