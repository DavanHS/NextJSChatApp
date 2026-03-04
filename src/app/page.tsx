import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const siteUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Anonymous Ephemeral Chat Rooms",
  description:
    "Start a secure, temporary chat room in seconds. Share the room ID and let every message self-destruct automatically.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TermiChat",
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description:
      "Privacy-focused temporary chat rooms where messages and rooms expire automatically.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <HomeClient />
    </>
  );
}
