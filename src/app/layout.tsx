import type { Metadata } from 'next';
import { Noto_Sans_Gujarati, Inter } from 'next/font/google';
import './globals.css';

const notoSansGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-gujarati',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Event ID Card Management System | Navratri Mahotsav 2026',
  description:
    'Multi-event ID card issuance, document verification, dynamic theme printing, and QR access verification system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansGujarati.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
