import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mineiro - Editor Visual para tu Web",
    template: "%s | Mineiro",
  },
  description: "Edita tu página web de forma visual sin código. Mineiro te permite gestionar productos, testimonios y contenido con un solo clic.",
  keywords: ["editor web", "CMS visual", "gestión de contenido", "tienda online", "productos", "testimonios", "Chile"],
  authors: [{ name: "Mineiro" }],
  creator: "Mineiro",
  publisher: "Mineiro",
  metadataBase: new URL("https://mineiro-clientes.vercel.app"),
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://mineiro-clientes.vercel.app",
    siteName: "Mineiro",
    title: "Mineiro - Editor Visual para tu Web",
    description: "Edita tu página web de forma visual sin código. Gestiona productos, testimonios y contenido con un solo clic.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mineiro - Editor Visual para tu Web",
    description: "Edita tu página web de forma visual sin código.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          src="https://www.google.com/recaptcha/api.js"
          async
          defer
        ></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
