import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

// Polices auto-hébergées au build : aucune requête vers Google depuis le navigateur.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });
const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Good Soup", template: "%s · Good Soup" },
  description: "Tes recettes, ton foyer, tes menus : le carnet de cuisine qui t'accompagne au quotidien.",
  applicationName: "Good Soup",
  appleWebApp: { capable: true, title: "Good Soup", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#F9EBD6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
