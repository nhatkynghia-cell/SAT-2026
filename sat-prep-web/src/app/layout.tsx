import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { GamificationProvider } from "@/context/GamificationContext";
import { ToastProvider } from "@/context/ToastContext";

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
        <GamificationProvider>
          <ToastProvider>
            <Sidebar />

            <main className="flex-1 overflow-y-auto">
              <div className="max-w-[1200px] mx-auto p-8">
                {children}
              </div>
            </main>
          </ToastProvider>
        </GamificationProvider>
      </body>
    </html>
  );
}
