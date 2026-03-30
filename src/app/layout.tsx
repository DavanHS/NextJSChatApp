import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "highlight.js/styles/github-dark.css"; // dark theme for code block syntax highlighting
import { Providers } from "@/components/providers";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://termi-chat-app.vercel.app"),
  title: "TermiChat — Private Encrypted Chat App | Self-Destructing Anonymous Chat",
  description:
    "TermiChat is a free terminal-themed private chat app with end-to-end encryption. Create temporary, self-destructing rooms for secure anonymous conversations and code sharing. No signup, no logs, full privacy.",
  keywords: [
    "private chat",
    "terminal chat app",
    "encrypted chat",
    "self-destructing chat",
    "anonymous chat",
    "secure messaging",
    "ephemeral chat",
    "code sharing",
    "termi-chat-app",
    "termichat",
    "termichatapp",
    "private chat app",
    "free private chat",
    "end-to-end encryption",
    "temporary chat room",
    "developer chat",
  ],
  icons: {
    icon: "/icon.ico",
  },
  openGraph: {
    title: "TermiChat — Private Terminal Chat App",
    description:
      "Free end-to-end encrypted chat with self-destructing rooms. No signup, no logs, full privacy. Perfect for private conversations and code sharing.",
    url: "https://termi-chat-app.vercel.app",
    siteName: "TermiChat",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TermiChat — Private Terminal Chat App",
    description:
      "Free end-to-end encrypted chat with self-destructing rooms. No signup, no logs, full privacy.",
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
  themeColor: "#000000",
  alternates: {
    canonical: "https://termi-chat-app.vercel.app",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "TermiChat",
              description:
                "Free terminal-themed private chat app with end-to-end encryption. Create temporary, self-destructing rooms for secure anonymous conversations and code sharing.",
              url: "https://termi-chat-app.vercel.app",
              applicationCategory: "CommunicationApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "End-to-end encryption",
                "Self-destructing chat rooms",
                "Anonymous chat",
                "Code syntax highlighting",
                "No signup required",
                "No data logging",
              ],
              keywords:
                "private chat, terminal chat, encrypted chat, self-destructing chat, anonymous chat, secure messaging, ephemeral chat, code sharing, termi-chat-app",
            }),
          }}
        />
        <Providers> {children}</Providers>
      </body>
    </html>
  );
}
