import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EquiRise | Startup Syndicate Platform",
  description: "Decentralized startup investment syndicate platform on Stellar. Pool capital, manage cap tables, and handle returns transparently.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen flex flex-col`}>
        <Providers>
          <div className="flex flex-1 overflow-hidden h-screen w-screen">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Area */}
            <div className="flex flex-col flex-1 overflow-hidden relative">
              {/* Background gradient flares */}
              <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
              <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/5 rounded-full blur-[100px] pointer-events-none" />

              <Navbar />
              
              <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-7xl mx-auto w-full relative z-10">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
