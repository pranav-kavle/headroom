import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { color } from "@headroom/tokens";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Headroom",
  description: "Everything you owe, weighed against what you have left.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Headroom",
  },
};

export const viewport: Viewport = {
  themeColor: color.violet,
  // `cover` is what makes env(safe-area-inset-*) resolve to anything but 0 —
  // without it the layout viewport stops short of the notch and home
  // indicator and the tab bar sits under the home bar.
  viewportFit: "cover",
  // Shrink the app shell when the virtual keyboard opens rather than letting
  // it cover the bottom of the screen.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}
      >
        <body>
          {children}
          <ServiceWorkerRegistration />
        </body>
      </html>
    </ClerkProvider>
  );
}
