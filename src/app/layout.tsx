import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Master Dashboard",
  description: "Trading Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="bg-[#0a0c10] text-gray-200 antialiased">
        {children}
      </body>
    </html>
  );
}