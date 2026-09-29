'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearAuthSession, User } from '@/lib/api';
import { LogOut, GraduationCap, Users, MessageSquare, BookOpen, Layers, ClipboardList, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
    setMobileMenuOpen(false);
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

  const mobileNavLinkClass = (href: string) => {
    const isActive = pathname === href || (href !== '/chat' && pathname?.startsWith(href));
    return isActive
      ? 'flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-bold bg-[#18181B] text-white transition-all'
      : 'flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F6] transition-all';
  };

  return (
    <header className="bg-white border-b border-[#E4E4E7] sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[58px] flex items-center justify-between">
        {/* Brand */}
        <Link href="/chat" className="flex items-center gap-2.5 no-underline flex-shrink-0">
          <div className="w-8 h-8 bg-[#18181B] rounded-md flex items-center justify-center relative flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#FF5500] rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[15px] text-[#09090B] tracking-tight">
                Smart Academic
              </span>
            </div>
            <span className="hidden sm:block font-mono font-semibold text-[9px] text-[#71717A] tracking-wider uppercase -mt-0.5">
              Academic Command Center
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        {user && (
          <nav className="hidden md:flex items-center gap-1.5">
            <Link href="/chat" className={navLinkClass('/chat')}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Chat</span>
            </Link>

            {user.role === 'STUDENT' && (
              <Link href="/enrollments" className={navLinkClass('/enrollments')}>
                <BookOpen className="w-3.5 h-3.5" />
                <span>My Subjects</span>
              </Link>
            )}

            {(user.role === 'FACULTY' || user.role === 'ADMIN') && (
              <>
                <Link href="/enrollments" className={navLinkClass('/enrollments')}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Teaching Subjects</span>
                </Link>

                <Link href="/faculty" className={navLinkClass('/faculty')}>
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Attendance Ledger</span>
                </Link>

                <Link href="/faculty/mark" className={navLinkClass('/faculty/mark')}>
                  <Users className="w-3.5 h-3.5" />
                  <span>Mark Attendance</span>
                </Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <Link href="/admin/allotment" className={navLinkClass('/admin/allotment')}>
                <Layers className="w-3.5 h-3.5" />
                <span>Allotment Engine</span>
              </Link>
            )}
          </nav>
        )}

        {/* Desktop User Info + Logout */}
        {user && (
          <div className="hidden md:flex items-center gap-3 pl-4 border-l border-[#E4E4E7]">
            <div className="text-right">
              <p className="font-bold text-xs text-[#09090B] leading-tight">
                {user.full_name}
              </p>
              <span className="font-mono text-[9.5px] font-bold text-[#FF5500] bg-[#FFF4ED] px-1.5 py-0.5 rounded tracking-wide uppercase inline-block mt-0.5">
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-md border border-[#E4E4E7] bg-white text-[#71717A] hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mobile Hamburger Toggle Button */}
        {user && (
          <div className="flex md:hidden items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-[#FF5500] bg-[#FFF4ED] px-2 py-0.5 rounded uppercase">
              {user.role}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md border border-[#E4E4E7] text-[#09090B] hover:bg-[#F4F4F6] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E4E4E7] bg-white px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-200">
          {/* User Profile Card */}
          <div className="p-3 bg-[#F4F4F6] rounded-md flex items-center justify-between border border-[#E4E4E7]">
            <div>
              <p className="font-bold text-sm text-[#09090B]">{user.full_name}</p>
              <p className="font-mono text-xs text-[#71717A] truncate max-w-[200px]">{user.email}</p>
            </div>
            <span className="font-mono text-xs font-bold text-[#FF5500] bg-[#FFF4ED] border border-[#FED7AA] px-2 py-0.5 rounded uppercase">
              {user.role}
            </span>
          </div>

          {/* Mobile Links */}
          <nav className="flex flex-col gap-1">
            <Link href="/chat" className={mobileNavLinkClass('/chat')}>
              <MessageSquare className="w-4 h-4 text-[#FF5500]" />
              <span>AI Assistant Chat</span>
            </Link>

            {user.role === 'STUDENT' && (
              <Link href="/enrollments" className={mobileNavLinkClass('/enrollments')}>
                <BookOpen className="w-4 h-4 text-[#FF5500]" />
                <span>My Subjects & Faculty</span>
              </Link>
            )}

            {(user.role === 'FACULTY' || user.role === 'ADMIN') && (
              <>
                <Link href="/enrollments" className={mobileNavLinkClass('/enrollments')}>
                  <BookOpen className="w-4 h-4 text-[#FF5500]" />
                  <span>Teaching Subjects</span>
                </Link>

                <Link href="/faculty" className={mobileNavLinkClass('/faculty')}>
                  <ClipboardList className="w-4 h-4 text-[#FF5500]" />
                  <span>Attendance Ledger</span>
                </Link>

                <Link href="/faculty/mark" className={mobileNavLinkClass('/faculty/mark')}>
                  <Users className="w-4 h-4 text-[#FF5500]" />
                  <span>Mark Attendance</span>
                </Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <Link href="/admin/allotment" className={mobileNavLinkClass('/admin/allotment')}>
                <Layers className="w-4 h-4 text-[#FF5500]" />
                <span>Allotment Engine</span>
              </Link>
            )}
          </nav>

          {/* Mobile Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Platform</span>
          </button>
        </div>
      )}
    </header>
  );
};
