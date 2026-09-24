import type { Metadata } from "next";
import "./globals.css";
import "./updates.css";
import AuthGate from "./auth-gate";

export const metadata: Metadata = {
  title: "Gestão Escolar | Infraestrutura e Suporte",
  description: "Gestão de unidades escolares, provedores, observações, infraestrutura e relatórios personalizados.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased"><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
