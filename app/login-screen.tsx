"use client";
import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "./auth-provider";
export default function LoginScreen(){
 const {login,loading}=useAuth(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setError("");try{await login(email.trim(),password)}catch(err){const msg=String((err as Error).message||"");setError(msg.includes("INVALID_LOGIN_CREDENTIALS")?"E-mail ou senha inválidos.":msg)}}
 return <main className="auth-screen"><div className="auth-card"><div className="auth-brand"><ShieldCheck/><div><strong>VIGI-ACCESS</strong><span>Operação técnica</span></div></div><h1>Acesso ao sistema</h1><p>Entre com seu usuário para acessar rotas, O.S. e checklists.</p><form onSubmit={submit}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="auth-error">{error}</div>}<button className="primary auth-submit" disabled={loading}>{loading?"Entrando...":"Entrar"}</button></form><small>O primeiro administrador deve ser criado no Firebase Authentication e depois receber o perfil <b>admin</b> no Firestore.</small></div></main>;
}
