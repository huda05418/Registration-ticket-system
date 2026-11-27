import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formulir",
  description: "Sistem Formulir & Registrasi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const snapUrl =
    process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL ||
    "https://app.sandbox.midtrans.com/snap/snap.js";
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";

  return (  
    <html lang="id">
      <head>
        <Script
          src={snapUrl}
          data-client-key={clientKey}
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-screen bg-[#f0ebf8] text-[#202124]">
        {children}
      </body>
    </html>
  );
}
