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
  title: "Fleet Maintenance Tracker",
  description: "Track and manage your truck fleet maintenance",
  keywords: ["fleet", "maintenance", "trucks", "management"],
  authors: [{ name: "Fleet Manager Team" }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: "Fleet Maintenance Tracker",
    description: "Track and manage your truck fleet maintenance",
    siteName: "Fleet Manager",
    type: "website",
    images: [{
      url: '/logo.svg',
      width: 200,
      height: 120,
      alt: 'Fleet Manager Logo'
    }]
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
