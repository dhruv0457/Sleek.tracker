import type { Metadata } from "next";
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeBootstrap } from "@/components/ui/ThemeBootstrap";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "sleek — embrace the friction and light up the night",
  description: "sleek — a focused, beautiful habit + task tracker. Embrace the friction and light up the night.",
  icons: {
    icon: "/icon.svg",
  },
  metadataBase: new URL("https://sleek-tracker.vercel.app"),
  openGraph: {
    title: "sleek — embrace the friction and light up the night",
    description: "A focused, beautiful habit + task tracker.",
    type: "website",
    images: [
      {
        url: "https://sleek-tracker.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "sleek habit tracker",
      }
    ]
  },
  // Correct Next.js architecture injection for custom meta tags
  other: {
    "google-adsense-account": "ca-pub-2400695376150743",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "sleek",
        "operatingSystem": "Web",
        "applicationCategory": "ProductivityApplication",
        "url": "https://sleek-tracker.vercel.app",
        "description": "A focused, beautiful habit + task tracker."
      },
      {
        "@type": "Organization",
        "name": "sleek",
        "url": "https://sleek-tracker.vercel.app",
        "logo": "https://sleek-tracker.vercel.app/icon.svg",
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "support@sleek-tracker.vercel.app",
          "contactType": "customer service"
        },
        "address": {
          "@type": "PostalAddress",
          "addressCountry": "US"
        }
      }
    ]
  };

  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-bg text-ink antialiased">
        <ThemeBootstrap />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
