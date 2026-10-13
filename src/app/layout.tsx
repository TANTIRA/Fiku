import type { Metadata } from "next";
import { DM_Sans, Pixelify_Sans } from "next/font/google";
import "./globals.css";

const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Fuku — asisten keuangan", template: "%s · Fuku" },
  description: "Catat uang masuk & keluar cukup dengan ngobrol. Ditemani Fuku, si koin 8-bit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${body.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
