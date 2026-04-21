import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'BioStimulant Funding Hub',
  description: 'Grants and funding for biostimulant users in USA and Canada.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F9FAF8] text-[#1A1A1A]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
