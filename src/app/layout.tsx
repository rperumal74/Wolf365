import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wolf365",
  description:
    "Secure Microsoft 365 billing reconciliation and invoicing staging for MSPs.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
