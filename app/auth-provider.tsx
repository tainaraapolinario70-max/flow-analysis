"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { ensureFreshSession, getDoc, getStoredSession, signIn as firebaseSignIn, storeSession, type FirebaseSession } from "@/lib/firebase-rest";

type UserProfile = { uid: string; email: string; name: string; role: "admin" | "technician"; active: boolean };
type AuthContextValue = { session: FirebaseSession | null; user: UserProfile | null; loading: boolean; login: (email:string,password:string)=>Promise<void>; logout:()=>void; refreshUser:()=>Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth(){ const value=useContext(AuthContext); if(!value) throw new Error("useAuth precisa de AuthProvider"); return value; }
export default function AuthProvider({children}:{children:React.ReactNode}){
 const [session,setSession]=useState<FirebaseSession|null>(null),[user,setUser]=useState<UserProfile|null>(null),[loading,setLoading]=useState(true);
 const load=async(s:FirebaseSession)=>{ const fresh=await ensureFreshSession(s); setSession(fresh); const profile=await getDoc("users",fresh.localId,fresh); if(!profile) throw new Error("Usuário sem perfil no sistema."); if(profile.active===false) throw new Error("Usuário bloqueado."); setUser({uid:fresh.localId,email:fresh.email,name:String(profile.name||fresh.email),role:profile.role==="admin"?"admin":"technician",active:profile.active!==false}); };
 useEffect(()=>{ const s=getStoredSession(); if(!s){setLoading(false);return;} load(s).catch(()=>{storeSession(null);setSession(null);setUser(null)}).finally(()=>setLoading(false)); },[]);
 async function login(email:string,password:string){setLoading(true);try{const s=await firebaseSignIn(email,password);await load(s)}finally{setLoading(false)}}
 function logout(){storeSession(null);setSession(null);setUser(null)}
 async function refreshUser(){if(session) await load(session)}
 return <AuthContext.Provider value={{session,user,loading,login,logout,refreshUser}}>{children}</AuthContext.Provider>;
}
