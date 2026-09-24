const authBase = "https://identitytoolkit.googleapis.com/v1";
const secureTokenBase = "https://securetoken.googleapis.com/v1";

export type FirebaseSession = {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  expiresIn: number;
  expiresAt: number;
};

export type FirebaseDoc = Record<string, unknown>;

function config() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error("Firebase não configurado. Preencha as variáveis NEXT_PUBLIC_FIREBASE_API_KEY e NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
  return { apiKey, projectId };
}

export function getStoredSession(): FirebaseSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem("vigi-firebase-session");
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

export function storeSession(session: FirebaseSession | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem("vigi-firebase-session", JSON.stringify(session));
  else localStorage.removeItem("vigi-firebase-session");
}

async function authRequest(path: string, body: Record<string, unknown>) {
  const { apiKey } = config();
  const response = await fetch(`${authBase}/${path}?key=${apiKey}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Falha na autenticação.");
  return data;
}

export async function signIn(email: string, password: string): Promise<FirebaseSession> {
  const data = await authRequest("accounts:signInWithPassword", { email, password, returnSecureToken: true });
  const session = { ...data, expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 } as FirebaseSession;
  storeSession(session); return session;
}

export async function signUp(email: string, password: string): Promise<FirebaseSession> {
  const data = await authRequest("accounts:signUp", { email, password, returnSecureToken: true });
  const session = { ...data, expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 } as FirebaseSession;
  return session;
}

export async function refreshSession(session: FirebaseSession): Promise<FirebaseSession> {
  const { apiKey } = config();
  const response = await fetch(`${secureTokenBase}/token?key=${apiKey}`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Sessão expirada.");
  const next = { ...session, idToken: data.id_token, refreshToken: data.refresh_token, localId: data.user_id, expiresIn: Number(data.expires_in), expiresAt: Date.now() + Number(data.expires_in) * 1000 };
  storeSession(next); return next;
}

export async function ensureFreshSession(session: FirebaseSession) {
  if (session.expiresAt - Date.now() > 120000) return session;
  return refreshSession(session);
}

function firestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, firestoreValue(v)])) } };
  return { stringValue: String(value) };
}

function fromFirestoreValue(value: any): any {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)]));
  return null;
}

export function decodeDocument(document: any): FirebaseDoc {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)]));
}

async function firestoreFetch(path: string, session: FirebaseSession, init: RequestInit = {}) {
  const fresh = await ensureFreshSession(session);
  const { projectId } = config();
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${fresh.idToken}`, "content-type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Falha no Firestore.");
  return data;
}

export async function listDocs(collection: string, session: FirebaseSession, where?: {field:string; value:string}) {
  if (!where) {
    const data = await firestoreFetch(collection, session);
    return (data.documents || []).map((doc: any) => ({ id: doc.name.split("/").pop(), ...decodeDocument(doc) }));
  }
  const fresh = await ensureFreshSession(session);
  const { projectId } = config();
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method:"POST", headers:{Authorization:`Bearer ${fresh.idToken}`,"content-type":"application/json"},
    body:JSON.stringify({structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:where.field},op:"EQUAL",value:firestoreValue(where.value)}},orderBy:[{field:{fieldPath:"createdAt"},direction:"DESCENDING"}]}})
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data?.error?.message||"Falha no Firestore.");
  return (data||[]).filter((x:any)=>x.document).map((x:any)=>({id:x.document.name.split("/").pop(),...decodeDocument(x.document)}));
}

export async function getDoc(collection: string, id: string, session: FirebaseSession) {
  try { return decodeDocument(await firestoreFetch(`${collection}/${encodeURIComponent(id)}`, session)); }
  catch { return null; }
}

export async function setDoc(collection: string, id: string, values: FirebaseDoc, session: FirebaseSession) {
  return firestoreFetch(`${collection}/${encodeURIComponent(id)}`, session, { method: "PATCH", body: JSON.stringify({ fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, firestoreValue(v)])) }) });
}

export async function deleteDoc(collection: string, id: string, session: FirebaseSession) {
  await firestoreFetch(`${collection}/${encodeURIComponent(id)}`, session, { method: "DELETE" });
}

