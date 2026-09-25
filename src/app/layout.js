import { Barlow, Barlow_Condensed } from 'next/font/google';
import "./globals.css"; // Esto mantiene tus estilos intactos

// Barlow Condensed en cursiva para titulares (evoca el logo inclinado de Ranked), Barlow para el texto
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-texto' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], style: ['normal', 'italic'], variable: '--font-titulo' });

export const metadata = {
  title: "Ranked · Torneo de Frontón",
  description: "Gestor de campeonatos de frontón by Ranked",
};

export const viewport = {
  themeColor: '#0B0F1E',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
