import "./globals.css"; // Esto mantiene tus estilos intactos

export const metadata = {
  title: "Torneo de Frontón",
  description: "Gestor del campeonato",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}