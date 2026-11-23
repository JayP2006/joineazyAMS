import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpenCheck, LayoutDashboard, Users, ClipboardList, BarChart3, LogOut, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    ...(user?.role === 'student' ? [{ to: '/groups', label: 'My group', icon: Users }] : [{ to: '/groups', label: 'Groups', icon: Users }]),
    { to: '/assignments', label: 'Assignments', icon: ClipboardList },
    ...(user?.role === 'admin' ? [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }] : [])
  ];

  const signOut = () => { logout(); navigate('/login'); };

  return <div className="min-h-screen bg-surface text-ink lg:flex">
    <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 bg-white px-5 py-7 lg:flex lg:flex-col">
      <div className="mb-10 flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white"><BookOpenCheck size={21} /></div><div><div className="font-display text-xl font-extrabold tracking-tight">joineazy</div><div className="text-xs text-muted">Assignment workspace</div></div></div>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</div>
      <nav className="space-y-1">{links.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive ? 'bg-indigo-50 text-brand' : 'text-slate-500 hover:bg-slate-50 hover:text-ink'}`}><item.icon size={18} />{item.label}</NavLink>)}</nav>
      <div className="mt-auto rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">{user?.role === 'admin' ? <ShieldCheck size={15} /> : <GraduationCap size={15} />}{user?.role === 'admin' ? 'Professor account' : 'Student account'}</div><p className="text-xs leading-5 text-muted">Keep your team aligned and every assignment on track.</p></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white"><BookOpenCheck size={19} /></div><span className="font-display text-lg font-extrabold">joineazy</span></div>
        <div className="hidden text-sm text-muted lg:block">Your collaborative learning space</div>
        <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-sm font-bold">{user?.full_name}</div><div className="text-xs capitalize text-muted">{user?.role}</div></div><div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-sm font-extrabold text-brand">{user?.full_name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><button onClick={signOut} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-rose-600" aria-label="Sign out"><LogOut size={17} /></button></div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">{links.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? 'bg-indigo-50 text-brand' : 'text-slate-500'}`}><item.icon size={15} />{item.label}</NavLink>)}</nav>
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9"><Outlet /></main>
    </div>
  </div>;
}
