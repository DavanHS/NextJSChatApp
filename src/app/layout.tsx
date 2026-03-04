import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const siteUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TermiChat | Private Self-Destructing Chat Rooms",
    template: "%s | TermiChat",
  },
  description:
    "Create private, temporary chat rooms with automatic self-destruction for privacy-first conversations.",
  applicationName: "TermiChat",
  keywords: [
    "private chat",
    "self-destructing messages",
    "ephemeral chat",
    "anonymous chat room",
    "secure realtime chat",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "TermiChat | Private Self-Destructing Chat Rooms",
    description:
      "Create private, temporary chat rooms with automatic self-destruction for privacy-first conversations.",
    url: "/",
    siteName: "TermiChat",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TermiChat | Private Self-Destructing Chat Rooms",
    description:
      "Spin up secure temporary chat rooms that auto-delete messages after expiration.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/icon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${jetbrainsMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
