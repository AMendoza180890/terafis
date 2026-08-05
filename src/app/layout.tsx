import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

import { ThemeScript } from "@/components/theme/ThemeScript";
import { BRAND_ICON_SRC, BRAND_LOGO_SRC, BRAND_OG_SRC } from "@/lib/brand";
import { SCHEME_COOKIE } from "@/lib/theme/resolution";

import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Terafis — Centro de Fisioterapia",
    template: "%s — Terafis",
  },
  description:
    "Sistema de gestión para clínica de fisioterapia. Expedientes, agenda y cobros con seguridad desde el día uno.",
  applicationName: "Terafis",
  icons: {
    icon: [
      { url: BRAND_ICON_SRC, type: "image/png", sizes: "256x256" },
      { url: BRAND_LOGO_SRC, type: "image/png" },
    ],
    apple: [{ url: BRAND_ICON_SRC, type: "image/png", sizes: "256x256" }],
    shortcut: BRAND_ICON_SRC,
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Terafis",
    title: "Terafis — Centro de Fisioterapia",
    description:
      "Gestión clínica para fisioterapia: agenda, expedientes, cola de atención y cobros.",
    images: [
      {
        url: BRAND_OG_SRC,
        width: 1200,
        height: 630,
        alt: "Terafis — Centro de Fisioterapia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terafis — Centro de Fisioterapia",
    description:
      "Gestión clínica para fisioterapia: agenda, expedientes, cola de atención y cobros.",
    images: [BRAND_OG_SRC],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const scheme = jar.get(SCHEME_COOKIE)?.value;
  const darkClass = scheme === "oscuro" ? "dark" : "";

  return (
    <html
      lang="es"
      className={`${sans.variable} ${serif.variable} ${darkClass} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
