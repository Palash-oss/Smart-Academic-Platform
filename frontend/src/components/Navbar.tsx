'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearAuthSession, fetchWithAuth, User } from '@/lib/api';
import { LogOut, GraduationCap, Users, MessageSquare, BookOpen, Layers, ClipboardList, Menu, X, Calendar, Bell, Sparkles, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    href?: string;
    type: 'warning' | 'info' | 'success';
    badge?: string;
  }>>([]);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const loadNotifications = async () => {
      const items: any[] = [];
      try {
        if (user.role === 'FACULTY' || user.role === 'ADMIN') {
          const res = await fetchWithAuth('/api/v1/timetable/swap-requests');
          if (res.ok) {
            const data = await res.json();
            const pending = (data.received || []).filter((r: any) => r.status === 'PENDING');
            if (pending.length > 0) {
              items.push({
                id: 'swap-pending',
                title: 'Peer Class Coverage Request',
                message: `${pending[0].requesting_faculty_name || 'A colleague'} requested class coverage for ${pending[0].course_abbr || 'lecture'} on ${pending[0].swap_date}.`,
                href: '/faculty/timetable',
                type: 'warning',
                badge: 'ACTION NEEDED',
              });
            }
          }
        } else if (user.role === 'STUDENT') {
          // Check dynamic live session
          const activeRes = await fetchWithAuth('/api/attendance/student/dynamic-session/active');
          if (activeRes.ok) {
            const actData = await activeRes.json();
            if (actData.has_active_session && !actData.already_checked_in) {
              items.push({
                id: 'dynamic-active',
                title: 'Classroom Live Attendance Open',
                message: `Instructor opened rolling token session for ${actData.subject}. Enter code on timetable to check in!`,
                href: '/timetable',
                type: 'success',
                badge: 'LIVE TOKEN',
              });
            }
          }
          // Extra Lecture added / cancelled notices (derived server-side, gone once the date passes)
          const extraRes = await fetchWithAuth('/api/v1/timetable/extra-lectures/notices');
          if (extraRes.ok) {
            const notices: Array<{ type: 'ADDED' | 'CANCELLED'; extra_lecture_id: string; subject_name: string; date: string; start_time: string }> = await extraRes.json();
            for (const n of notices) {
              const cancelled = n.type === 'CANCELLED';
              items.push({
                id: `extra-${n.type}-${n.extra_lecture_id}`,
                title: cancelled ? 'Extra Lecture Cancelled' : 'Extra Lecture Added',
                message: `${cancelled ? 'Extra lecture cancelled' : 'Extra lecture added'}: ${n.subject_name}, ${n.date} ${n.start_time}`,
                href: '/timetable',
                type: cancelled ? 'warning' : 'info',
                badge: cancelled ? 'CANCELLED' : 'EXTRA',
              });
            }
          }
          // Check student attendance threshold
          const attRes = await fetchWithAuth('/api/attendance/my');
          if (attRes.ok) {
            const attData = await attRes.json();
            if (attData.overall_percentage !== undefined && attData.overall_percentage < 75) {
              items.push({
                id: 'attendance-low',
                title: 'Attendance Warning (<75%)',
                message: `Current overall attendance is ${attData.overall_percentage}%, below the mandatory 75% autonomous threshold.`,
                href: '/chat',
                type: 'warning',
                badge: 'ORDINANCE 4.2',
              });
            }
          }
        }
      } catch (err) {
        // Silent
      }
      setNotifications(items);
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 7000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  if (!user && pathname === '/login') {
    return null;
  }

  const isLinkActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href === '/faculty' || href === '/admin' || href === '/chat') {
      return pathname === href;
    }
    return pathname.startsWith(href + '/');
  };

  const navLinkClass = (href: string) => {
    const isActive = isLinkActive(href);
    return isActive
      ? 'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#18181B] text-white border border-[#18181B] transition-all'
      : 'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F6] transition-all';
  };

  const mobileNavLinkClass = (href: string) => {
    const isActive = isLinkActive(href);
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
              <>
                <Link href="/electives/select" className={navLinkClass('/electives/select')}>
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Elective Selection</span>
                </Link>
                <Link href="/enrollments" className={navLinkClass('/enrollments')}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>My Subjects</span>
                </Link>
                <Link href="/timetable" className={navLinkClass('/timetable')}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>My Timetable</span>
                </Link>
              </>
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

                <Link href="/faculty/timetable" className={navLinkClass('/faculty/timetable')}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>My Timetable</span>
                </Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <>
                <Link href="/admin/allotment" className={navLinkClass('/admin/allotment')}>
                  <Layers className="w-3.5 h-3.5" />
                  <span>Allotment Engine</span>
                </Link>

                <Link href="/admin/timetable" className={navLinkClass('/admin/timetable')}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Master Timetable</span>
                </Link>
              </>
            )}
          </nav>
        )}

        {/* Desktop User Info + Logout */}
        {user && (
          <div className="hidden md:flex items-center gap-3 pl-4 border-l border-[#E4E4E7]">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-1.5 rounded-md border border-[#E4E4E7] bg-white text-[#71717A] hover:bg-[#F4F4F6] hover:text-[#09090B] transition-all cursor-pointer"
                title="System Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF5500] text-white text-[9.5px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E4E4E7] rounded-lg shadow-xl z-50 p-3 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7] mb-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                      Institutional Broadcasts
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#FF5500] bg-[#FFF4ED] px-1.5 py-0.5 rounded">
                      {notifications.length} Active
                    </span>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#71717A] font-sans">
                      <ShieldCheck className="w-6 h-6 text-[#16A34A] mx-auto mb-1.5 opacity-80" />
                      All systems synchronized. No pending alerts.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.href || '#'}
                          onClick={() => setNotificationsOpen(false)}
                          className="block p-2.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFB] hover:bg-white hover:border-[#FF5500] transition-all no-underline text-left group"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs text-[#09090B] group-hover:text-[#FF5500] transition-colors">
                              {n.title}
                            </span>
                            {n.badge && (
                              <span className="font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                                {n.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#52525B] leading-snug">
                            {n.message}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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
            {/* Mobile notification pill */}
            {notifications.length > 0 && (
              <Link
                href={notifications[0].href || '/timetable'}
                className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded animate-pulse"
              >
                <Bell className="w-3 h-3" />
                <span>{notifications.length}</span>
              </Link>
            )}
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
              <>
                <Link href="/electives/select" className={mobileNavLinkClass('/electives/select')}>
                  <ClipboardList className="w-4 h-4 text-[#FF5500]" />
                  <span>Elective Selection Form</span>
                </Link>
                <Link href="/enrollments" className={mobileNavLinkClass('/enrollments')}>
                  <BookOpen className="w-4 h-4 text-[#FF5500]" />
                  <span>My Subjects & Faculty</span>
                </Link>
                <Link href="/timetable" className={mobileNavLinkClass('/timetable')}>
                  <Calendar className="w-4 h-4 text-[#FF5500]" />
                  <span>My Timetable</span>
                </Link>
              </>
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

                <Link href="/faculty/timetable" className={mobileNavLinkClass('/faculty/timetable')}>
                  <Calendar className="w-4 h-4 text-[#FF5500]" />
                  <span>My Timetable</span>
                </Link>
              </>
            )}

            {user.role === 'ADMIN' && (
              <>
                <Link href="/admin/allotment" className={mobileNavLinkClass('/admin/allotment')}>
                  <Layers className="w-4 h-4 text-[#FF5500]" />
                  <span>Allotment Engine</span>
                </Link>

                <Link href="/admin/timetable" className={mobileNavLinkClass('/admin/timetable')}>
                  <Calendar className="w-4 h-4 text-[#FF5500]" />
                  <span>Master Timetable</span>
                </Link>
              </>
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

export default Navbar;
