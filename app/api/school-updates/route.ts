import {env} from "cloudflare:workers";
import {ensureDatabaseSchema} from "../../../db/ensure-schema";
type E={DB:D1Database};
const headers={"cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","expires":"0"};
export async function GET(){const db=(env as E).DB;await ensureDatabaseSchema(db);const r=await db.prepare(`SELECT id,school_id schoolId,school_name schoolName,type,content,created_at createdAt FROM school_updates ORDER BY id ASC`).all();return Response.json(r.results,{headers})}
export async function POST(req:Request){const b=await req.json() as any;if(!b.schoolId||!["observation","status","equipment"].includes(b.type)||typeof b.content!=="string")return Response.json({error:"Dados inválidos"},{status:400,headers});const createdAt=new Date().toISOString(),db=(env as E).DB;await ensureDatabaseSchema(db);const r=await db.prepare(`INSERT INTO school_updates (school_id,school_name,type,content,created_at) VALUES (?,?,?,?,?)`).bind(b.schoolId,b.schoolName,b.type,b.content,createdAt).run();return Response.json({...b,id:r.meta.last_row_id,createdAt},{status:201,headers})}
