import {env} from "cloudflare:workers";
import {ensureDatabaseSchema} from "../../../db/ensure-schema";
type E={DB:D1Database};
const headers={"cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","expires":"0"};
export async function GET(){const db=(env as E).DB;await ensureDatabaseSchema(db);const result=await db.prepare(`SELECT id,school_id schoolId,school_name schoolName,created_at createdAt FROM school_accesses ORDER BY created_at DESC,id DESC LIMIT 100`).all();return Response.json(result.results,{headers})}
export async function POST(request:Request){const body=await request.json() as any;if(!body.schoolId||!body.schoolName)return Response.json({error:"Dados inválidos"},{status:400,headers});const createdAt=new Date().toISOString(),db=(env as E).DB;await ensureDatabaseSchema(db);const result=await db.prepare(`INSERT INTO school_accesses (school_id,school_name,created_at) VALUES (?,?,?)`).bind(body.schoolId,body.schoolName,createdAt).run();return Response.json({...body,id:result.meta.last_row_id,createdAt},{status:201,headers})}
