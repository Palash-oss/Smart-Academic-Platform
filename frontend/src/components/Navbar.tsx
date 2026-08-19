'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearAuthSession, User } from '@/lib/api';
import { LogOut, GraduationCap, Users, MessageSquare } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  if (!user && pathname === '/login') {
    return null;
  }

  return (
    <header className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between sticky top-0 z-50 shadow-xs">
      <div className="flex items-center gap-6">
        <Link href="/chat" className="flex items-center gap-2 font-serif text-lg tracking-wider text-paper font-semibold hover:opacity-80 transition-opacity">
          <GraduationCap className="h-5 w-5 text-paper" />
          <span>ACADEMIC COMMAND CENTER</span>
        </Link>
        <span className="text-xs font-mono text-subtle border border-border px-2 py-0.5 rounded bg-ink">v0.1.0-MVP</span>
      </div>

      <div className="flex items-center gap-6">
        {user && (
          <nav className="flex items-center gap-4 text-sm font-sans">
            <Link
              href="/chat"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs uppercase tracking-wider font-medium transition-colors ${
                pathname === '/chat'
                  ? 'bg-paper text-ink border border-paper font-bold'
                  : 'text-subtle hover:text-paper hover:bg-ink'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Multi-Agent Chat</span>
            </Link>

            {user.role === 'FACULTY' && (
              <Link
                href="/faculty"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs uppercase tracking-wider font-medium transition-colors ${
                  pathname === '/faculty'
                    ? 'bg-paper text-ink border border-paper font-bold'
                    : 'text-subtle hover:text-paper hover:bg-ink'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Attendance Ledger</span>
              </Link>
            )}
          </nav>
        )}

        {user && (
          <div className="flex items-center gap-4 pl-4 border-l border-border">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-paper">{user.full_name}</p>
              <p className="text-[10px] font-mono text-subtle uppercase tracking-wider">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-subtle hover:text-paper hover:bg-ink rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
