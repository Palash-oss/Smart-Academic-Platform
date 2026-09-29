'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearAuthSession, User } from '@/lib/api';
import { LogOut, GraduationCap, Users, MessageSquare, BookOpen, Layers, ClipboardList } from 'lucide-react';

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

  const navLinkClass = (href: string) => {
    const isActive = pathname === href || (href !== '/chat' && pathname?.startsWith(href));
    return isActive
      ? 'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#18181B] text-white border border-[#18181B] transition-all'
      : 'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F6] transition-all';
  };

  return (
    <header
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E4E4E7',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '58px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand - Technical Architectural Style */}
        <Link
          href="/chat"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              background: '#18181B',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <GraduationCap style={{ width: '17px', height: '17px', color: '#FFFFFF' }} />
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '6px',
                height: '6px',
                background: '#FF5500',
                borderRadius: '50%',
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: '#09090B',
                  letterSpacing: '-0.02em',
                }}
              >
                Smart Academic
              </span>
            </div>
            <span
              style={{
                display: 'block',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600,
                fontSize: '9.5px',
                color: '#71717A',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '-1px',
              }}
            >
              Academic Command Center
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        {user && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link href="/chat" className={navLinkClass('/chat')}>
              <MessageSquare style={{ width: '14px', height: '14px' }} />
              <span>AI Chat</span>
            </Link>

            {user.role === 'STUDENT' && (
              <Link href="/enrollments" className={navLinkClass('/enrollments')}>
                <BookOpen style={{ width: '14px', height: '14px' }} />
                <span>My Subjects</span>
              </Link>
            )}

            {(user.role === 'FACULTY' || user.role === 'ADMIN') && (
              <>
                <Link href="/enrollments" className={navLinkClass('/enrollments')}>
                  <BookOpen style={{ width: '14px', height: '14px' }} />
                  <span>Teaching Subjects</span>
                </Link>

                <Link href="/faculty" className={navLinkClass('/faculty')}>
                  <ClipboardList style={{ width: '14px', height: '14px' }} />
                  <span>Attendance Ledger</span>
                </Link>

                <Link href="/faculty/mark" className={navLinkClass('/faculty/mark')}>
                  <Users style={{ width: '14px', height: '14px' }} />
                  <span>Mark Attendance</span>
                </Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <Link href="/admin/allotment" className={navLinkClass('/admin/allotment')}>
                <Layers style={{ width: '14px', height: '14px' }} />
                <span>Allotment Engine</span>
              </Link>
            )}
          </nav>
        )}

        {/* User Info + Logout */}
        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingLeft: '16px',
              borderLeft: '1px solid #E4E4E7',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#09090B',
                  lineHeight: 1.2,
                }}
              >
                {user.full_name}
              </p>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#FF5500',
                  background: '#FFF4ED',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'inline-block',
                  marginTop: '2px',
                }}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid #E4E4E7',
                background: '#FFFFFF',
                cursor: 'pointer',
                color: '#71717A',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FEF2F2';
                e.currentTarget.style.borderColor = '#FECACA';
                e.currentTarget.style.color = '#DC2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E4E4E7';
                e.currentTarget.style.color = '#71717A';
              }}
            >
              <LogOut style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
