import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { GamificationProvider } from "@/context/GamificationContext";
import { ToastProvider } from "@/context/ToastContext";
import { BadgeUnlockWatcher } from "@/components/BadgeUnlockWatcher";

export const metadata: Metadata = {
  title: "Gia sư AI SAT - Phú Gia Education",
  description: "Gamified SAT Prep Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="flex h-screen overflow-hidden bg-[#0e1117] text-[#fafafa] font-sans">
        <AuthProvider>
          <GamificationProvider>
            <ToastProvider>
              <BadgeUnlockWatcher />
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </GamificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
