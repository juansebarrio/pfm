import type { Metadata, Viewport } from "next";
import { Rubik, Spline_Sans_Mono } from "next/font/google";
import { RegistroSW } from "@/components/sistema/RegistroSW";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sobres",
  description:
    "PFM personal y familiar para Argentina: presupuesto por sobres, tarjetas con ciclos reales, cuotas y patrimonio.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sobres",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1E6E52" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Aplica el tema guardado antes del primer paint para evitar flash
const scriptTema = `try{var t=localStorage.getItem("tema");if(t==="oscuro"||t==="claro")document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body
        className={`${rubik.variable} ${splineSansMono.variable} antialiased`}
      >
        <div className="mx-auto min-h-dvh w-full max-w-[430px] min-[431px]:border-x min-[431px]:border-borde">
          {children}
        </div>
        <RegistroSW />
      </body>
    </html>
  );
}
