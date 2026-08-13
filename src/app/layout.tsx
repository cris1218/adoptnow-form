import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";

import "./globals.css";

const siteUrl = "https://recantoronron.vercel.app";
const siteTitle = "Quero adotar | Recanto do Ron Ron";
const siteDescription =
  "Questionário de adoção responsável do Recanto do Ron Ron. Leia as regras, deixe seu nome e WhatsApp e a equipe entra em contato.";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "Recanto do Ron Ron",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Recanto do Ron Ron",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#148B87",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
