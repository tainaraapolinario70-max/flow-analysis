"use client";
import AuthProvider,{useAuth} from "./auth-provider";
import LoginScreen from "./login-screen";
import OperationsModule from "./operations-module";
function Gate({children}:{children:React.ReactNode}){const {user,loading}=useAuth();if(loading)return <main className="auth-screen"><div className="auth-card"><h1>Carregando sistema...</h1></div></main>;if(!user)return <LoginScreen/>;if(user.role==="technician")return <OperationsModule/>;return <div className="authenticated-app"><OperationsModule/><div className="legacy-app">{children}</div></div>}
export default function AuthGate({children}:{children:React.ReactNode}){return <AuthProvider><Gate>{children}</Gate></AuthProvider>}
