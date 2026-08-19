import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Smart Academic Platform | Multi-Agent Assistant',
  description: 'Academic Command Center featuring pgvector RAG Student Support and Deterministic Attendance Intelligence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-ink text-paper antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
