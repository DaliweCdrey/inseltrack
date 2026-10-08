import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "InselTrack",
  description: "Internal project tracking and client reporting"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
