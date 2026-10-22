import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cricket Tournament Player Registration & Auction Draft Pool',
  description: 'Official player registration portal for Premier Cricket League 2026. Register now to enter the mega player auction.',
  keywords: 'cricket tournament, player registration, cricket auction, player draft, razorpay payment',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
      </body>
    </html>
  );
}
