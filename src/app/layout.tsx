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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fleet Maintenance Tracker",
  description: "Track and manage your truck fleet maintenance",
  keywords: ["fleet", "maintenance", "trucks", "management"],
  authors: [{ name: "Fleet Manager Team" }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon-192.svg',
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
                  <Layout>
                    {children}
                  </Layout>
                </PermissionsProvider>
              </SidebarProvider>
            </AuthProvider>
            <Toaster />
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
