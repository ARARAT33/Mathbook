import type { Metadata } from 'next';
import { Noto_Sans_Armenian, Noto_Serif_Armenian, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const notoSansArmenian = Noto_Sans_Armenian({
  subsets: ['armenian', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-arm',
  display: 'swap',
});

const notoSerifArmenian = Noto_Serif_Armenian({
  subsets: ['armenian', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif-arm',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Հանրահաշիվ 8–9 · Հայերեն թարգմանություն',
  description:
    'Մ. Լ. Գալիցկու, Ա. Մ. Գոլդմանի և Լ. Ի. Զվավիչի «Հանրահաշվի խնդրագիրք 8–9 դասարանների համար» (272 էջ) գրքի ամբողջական հայերեն թարգմանություն՝ պահպանելով բոլոր մաթեմատիկական բանաձևերը։',
  openGraph: {
    title: 'Հանրահաշիվ 8–9 · Հայերեն թարգմանություն',
    description:
      'Մ. Լ. Գալիցկու «Հանրահաշվի խնդրագիրք 8–9 դասարանների համար» գրքի ամբողջական և ճշգրիտ հայերեն թարգմանություն։',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Հանրահաշիվ 8–9 · Հայերեն թարգմանություն',
    description:
      'Մ. Լ. Գալիցկու «Հանրահաշվի խնդրագիրք 8–9 դասարանների համար» գրքի ամբողջական և ճշգրիտ հայերեն թարգմանություն։',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="hy"
      className={`${notoSansArmenian.variable} ${notoSerifArmenian.variable} ${ibmPlexMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-[#0284C7]/15 selection:text-[#0F172A]"
      >
        {children}
      </body>
    </html>
  );
}
