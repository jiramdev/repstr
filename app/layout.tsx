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
  title: "repstr",
  description: "Every rep, counted.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "repstr",
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
        className={`${inter.variable} ${anton.variable} font-sans antialiased min-h-dvh selection:bg-[#141416] selection:text-[#baa3d0]`}
        style={{ backgroundColor: "#baa3d0", colorScheme: "light" }}
      >
        <style>{`
          html, body { background: #baa3d0; color-scheme: light; }
          #boot-splash {
            position: fixed;
            inset: 0;
            z-index: 80;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #baa3d0;
            color: #141416;
            pointer-events: none;
          }
          #boot-splash .boot-mark {
            position: absolute;
            left: 50%;
            bottom: calc(50% + 5vh);
            transform: translateX(-50%);
            width: 40vw;
            max-width: 230px;
          }
          #boot-splash .boot-mark svg {
            display: block;
            width: 100%;
            height: auto;
          }
          /* The animation only starts once .boot-go is added after paint,
             so the slide-in is fully visible even on slow loads. */
          #boot-splash .boot-half-l,
          #boot-splash .boot-half-r {
            opacity: 0;
          }
          #boot-splash.boot-go .boot-half-l {
            animation: boot-slide-l 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.05s both;
          }
          #boot-splash.boot-go .boot-half-r {
            animation: boot-slide-r 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.05s both;
          }
          @keyframes boot-slide-l {
            from { opacity: 0; transform: translateX(-30%); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes boot-slide-r {
            from { opacity: 0; transform: translateX(30%); }
            to { opacity: 1; transform: translateX(0); }
          }
          /* The wordmark matches the static iOS splash pixel-for-pixel from
             frame 0 and never moves: only the loop mark animates above it. */
          #boot-splash .boot-word {
            width: 45vw;
            max-width: 350px;
          }
          #boot-splash .boot-word svg {
            display: block;
            width: 100%;
            height: auto;
          }
          @media (prefers-reduced-motion: reduce) {
            #boot-splash .boot-half-l,
            #boot-splash .boot-half-r {
              animation: none;
              opacity: 1;
              transform: none;
            }
          }
        `}</style>
        <div id="boot-splash" aria-hidden="true">
          <div className="boot-mark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 100">
              <path
                className="boot-half-l"
                fill="#141416"
                fillRule="evenodd"
                d="M76 100 L96.7 77 L72.7 77 L121.3 23 L179.3 23 L200 0 L90 0 L0 100Z"
              />
              <path
                className="boot-half-r"
                fill="#141416"
                fillRule="evenodd"
                d="M200 100 L290 0 L214 0 L193.3 23 L217.3 23 L168.7 77 L110.7 77 L90 100Z"
              />
            </svg>
          </div>
          <div className="boot-word">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 100">
              <path
                fill="#141416"
                fillRule="evenodd"
                d="M0 100 L52 100 L86.65 61.5 L108.65 61.5 L108 100 L160 100 L160.65 61.5 L194.65 61.5 L250 0 L90 0ZM107.35 38.5 L121.3 23 L177.3 23 L163.35 38.5ZM334 100 L354.7 77 L246.7 77 L295.3 23 L403.3 23 L424 0 L264 0 L174 100ZM296.35 38.5 L275.65 61.5 L348.65 61.5 L369.35 38.5ZM400 100 L434.65 61.5 L542.65 61.5 L598 0 L438 0 L348 100ZM469.3 23 L525.3 23 L511.35 38.5 L455.35 38.5ZM664.65 61.5 L650.7 77 L542.7 77 L522 100 L682 100 L737.35 38.5 L629.35 38.5 L643.3 23 L751.3 23 L772 0 L612 0 L556.65 61.5ZM765.3 23 L819.3 23 L750 100 L802 100 L871.3 23 L925.3 23 L946 0 L786 0ZM922 100 L956.65 61.5 L978.65 61.5 L978 100 L1030 100 L1030.65 61.5 L1064.65 61.5 L1120 0 L960 0 L870 100ZM991.3 23 L1047.3 23 L1033.35 38.5 L977.35 38.5Z"
              />
            </svg>
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