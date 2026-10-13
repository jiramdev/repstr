// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Anton } from "next/font/google";
import "./globals.css";
import BottomBar from "@/components/BottomBar";
import LaunchScreen from "@/components/LaunchScreen";
import OpenFromNotification from "@/components/OpenFromNotification";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "repiq",
  description: "Every rep, counted.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "repiq",
    startupImage: [
      {
        url: "/splash/iphone-14.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-14-pro.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-14-plus.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-14-pro-max.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-16-pro.png",
        media:
          "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-16-pro-max.png",
        media:
          "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-11.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/iphone-x.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/iphone-se.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#baa3d0",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: "#baa3d0", colorScheme: "light" }}>
      <body
        className={`${inter.variable} ${anton.variable} font-sans antialiased min-h-screen selection:bg-[#141416] selection:text-[#baa3d0]`}
        style={{ backgroundColor: "#baa3d0", colorScheme: "light" }}
      >
        <style>{`
          html, body { background: #baa3d0; color-scheme: light; }
          #boot-splash {
            position: fixed;
            inset: 0;
            z-index: 80;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #baa3d0;
            color: #141416;
          }
          #boot-splash .boot-name {
            margin: 0;
            font-family: var(--font-anton), Impact, sans-serif;
            font-size: 88px;
            letter-spacing: -0.03em;
            line-height: 0.88;
          }
          #boot-splash .boot-slogan {
            margin: 20px 0 0;
            font-size: 15px;
            font-weight: 500;
            letter-spacing: -0.015em;
            opacity: 0.7;
          }
          #boot-splash .boot-track {
            margin-top: 24px;
            height: 3px;
            width: 112px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(20, 20, 22, 0.15);
          }
          #boot-bar {
            height: 100%;
            width: 0%;
            border-radius: 999px;
            background: #141416;
            transition: width 200ms ease-out;
          }
          @media (prefers-reduced-motion: reduce) {
            #boot-bar { transition: none; }
          }
        `}</style>
        <div id="boot-splash" aria-hidden="true">
            <p className="boot-name">repiq</p>
            <p className="boot-slogan">Every rep, counted.</p>
            <div className="boot-track">
              <div id="boot-bar" />
            </div>
        </div>
        <div id="page-root">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
        <BottomBar />
        <LaunchScreen />
        <OpenFromNotification />
      </body>
    </html>
  );
}