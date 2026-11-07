import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "Recobra", description: "Recuperación de deducciones de plataformas de delivery" };

const nav = [
  ["/deducciones", "Deducciones"],
  ["/clientes", "Clientes"],
  ["/importar", "Importar"],
  ["/recuperaciones", "Recuperaciones"],
  ["/facturas", "Facturas"],
  ["/informes", "Informes"],
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 text-sm">
            <span className="font-semibold">Recobra</span>
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="text-slate-600 hover:text-slate-900">{label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
