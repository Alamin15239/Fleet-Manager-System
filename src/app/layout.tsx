import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/layout";
import { AuthProvider } from "@/contexts/auth-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { LanguageProvider } from "@/contexts/language-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { StorageInit } from "@/components/storage-init";
import { RealTimeProvider } from "../../components/real-time-provider";
import { ClarityAnalytics } from "@/components/clarity-analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.primeofferonline.shop'),
  title: "🚛 Fleet Manager Pro - Complete Truck Fleet Management System",
  description: "Professional fleet management solution for truck maintenance, tire tracking, analytics & reporting. Streamline your fleet operations with real-time monitoring and predictive maintenance.",
  keywords: ["fleet management", "truck maintenance", "tire management", "fleet tracking", "vehicle maintenance", "fleet analytics", "truck fleet", "maintenance software", "fleet operations", "vehicle tracking"],
  authors: [{ name: "Fleet Manager Pro Team" }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: "🚛 Fleet Manager Pro - Complete Truck Fleet Management System",
    description: "Professional fleet management solution with maintenance tracking, tire management, real-time analytics and comprehensive reporting. Optimize your fleet operations today!",
    siteName: "Fleet Manager Pro",
    type: "website",
    url: 'https://www.primeofferonline.shop',
    images: [{
      url: '/logo.svg',
      width: 1200,
      height: 630,
      alt: 'Fleet Manager Pro - Truck Fleet Management System'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: "🚛 Fleet Manager Pro - Complete Truck Fleet Management",
    description: "Professional fleet management solution with maintenance tracking, tire management & analytics.",
    images: ['/logo.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <AuthProvider>
              <SidebarProvider>
                <PermissionsProvider>
                  <RealTimeProvider>
                    <Layout>
                      {children}
                    </Layout>
                  </RealTimeProvider>
                </PermissionsProvider>
              </SidebarProvider>
            </AuthProvider>
            <Toaster />
          </LanguageProvider>
        </ThemeProvider>
        <StorageInit />
        <ClarityAnalytics />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
