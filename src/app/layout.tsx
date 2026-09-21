import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Tooltip } from "radix-ui";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jev Bookmarker",
  description:
    "Save a link and let Jev, via the Vercel AI Gateway, categorize and prioritize it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Tooltip.Provider delayDuration={200}>{children}</Tooltip.Provider>
      </body>
    </html>
  );
}
