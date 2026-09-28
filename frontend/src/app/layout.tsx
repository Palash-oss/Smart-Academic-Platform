import type { Metadata } from 'next';
import '@/styles/globals.css';
import SmoothScroll from '@/components/SmoothScroll';

export const metadata: Metadata = {
  title: 'Smart Academic Platform | Academic Command Center',
  description: 'A multi-agent academic assistant featuring pgvector RAG for policy queries and deterministic attendance intelligence for university students and faculty.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          background: '#ECECEE',
          color: '#09090B',
          minHeight: '100vh',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
