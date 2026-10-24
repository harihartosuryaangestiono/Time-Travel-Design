import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#09090B",
};

export const metadata: Metadata = {
  title: "Time Travel Design — Financial Architecture",
  description: "Enterprise Financial Architecture & Project Cost Accounting System",
  applicationName: "Time Travel Design Finance",
  appleWebApp: {
    capable: true,
    title: "TTD Finance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/images/Logo%20%26%20Tulisan%20-%20B.png", type: "image/png" }],
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%2309090B' rx='20' width='100' height='100'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='46' font-family='sans-serif' font-weight='900' fill='white'>TT</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
