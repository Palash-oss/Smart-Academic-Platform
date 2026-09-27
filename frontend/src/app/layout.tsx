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
      <body style={{ background: '#ECECEE', color: '#09090B', minHeight: '100vh' }}>
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
