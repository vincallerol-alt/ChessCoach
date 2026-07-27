import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ChessCoach", template: "%s · ChessCoach" },
  description: "Votre coach d’échecs personnel, construit à partir de vos parties.",
  manifest: "/manifest.webmanifest",
  openGraph: { title: "ChessCoach", description: "Votre jeu. Votre plan.", images: [{ url: "/og-chesscoach.png", width: 1200, height: 630 }] },
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "ChessCoach", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#18251f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}