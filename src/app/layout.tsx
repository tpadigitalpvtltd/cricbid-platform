import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'CricBid - Cricket Tournament & Auction Draft Platform',
  description: 'Official tournament player registration and mega cricket auction draft platform.',
  keywords: 'cricket tournament, player registration, cricket auction, player draft, cricbid, razorpay payment',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'CricBid - Cricket Tournament & Player Auction Platform',
    description: 'Register for upcoming tournaments and join the live auction pool.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Google Fonts: Rajdhani & Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Rajdhani:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-[#080d1a] text-slate-100 flex flex-col">
        {/* Razorpay Standard Checkout SDK */}
        <Script
          id="razorpay-checkout"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        {children}
        {/* Suppress Netlify HUD / "Powered by Netlify" floating badge */}
        <div id="nl-badge-frame" style={{ display: 'none' }} aria-hidden="true" />
        <div id="nl-hud-frame" style={{ display: 'none' }} aria-hidden="true" />
      </body>
    </html>
  );
}
