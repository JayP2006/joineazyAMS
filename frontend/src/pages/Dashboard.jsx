import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CheckCircle2, Clock3, Users, ClipboardList, Sparkles, CalendarDays } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Loading, PageHeading, StatCard } from '../components/Primitives';

const dateLabel = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [assignmentResponse, groupResponse] = await Promise.all([api.get('/assignments'), api.get('/groups')]);
        if (!active) return;
        setAssignments(assignmentResponse.data.assignments);
        setGroups(groupResponse.data.groups);
        if (user.role === 'admin') {
          const { data } = await api.get('/admin/analytics');
          if (active) setAnalytics(data);
        }
      } finally { if (active) setLoading(false); }
    };
    load().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.role]);

  if (loading) return <Loading />;
  const submitted = assignments.filter(item => item.submitted).length;
  const pending = assignments.length - submitted;
  const completion = assignments.length ? Math.round(submitted / assignments.length * 100) : 0;
  const upcoming = [...assignments].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 4);
  const chartData = analytics?.assignments?.slice(0, 6).map(item => ({ name: item.title.length > 16 ? `${item.title.slice(0, 16)}…` : item.title, submitted: item.submitted_groups, pending: Math.max(0, item.total_groups - item.submitted_groups) })) || [];

  return <>
    <PageHeading eyebrow={user.role === 'admin' ? 'Professor workspace' : 'Student workspace'} title={`Good day, ${user.full_name?.split(' ')[0] || 'there'}.`} description={user.role === 'admin' ? 'Here is the latest picture of your assignments, groups and student submissions.' : 'Your team workspace at a glance. Stay organized and keep every deadline in sight.'} action={<button onClick={() => navigate('/assignments')} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700">{user.role === 'admin' ? 'Manage assignments' : 'View assignments'}<ArrowUpRight size={17} /></button>} />
    {user.role === 'admin' ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Students" value={analytics?.summary.students ?? 0} detail="Registered learners" icon={Users} /><StatCard label="Active groups" value={analytics?.summary.groups ?? 0} detail="Student teams" icon={Users} tone="violet" /><StatCard label="Assignments" value={analytics?.summary.assignments ?? 0} detail="Created by professors" icon={BookOpen} tone="amber" /><StatCard label="Submissions" value={analytics?.summary.submissions ?? 0} detail="Group confirmations" icon={CheckCircle2} tone="emerald" /></div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-lg font-extrabold">Submission overview</h2><p className="mt-1 text-xs text-muted">Submitted and pending groups by assignment</p></div><div className="rounded-lg bg-indigo-50 p-2 text-brand"><Sparkles size={18} /></div></div>{chartData.length ? <div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={5}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#98a2b3', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f7f8fc' }} /><Bar dataKey="submitted" name="Submitted" fill="#4f46e5" radius={[5, 5, 0, 0]} /><Bar dataKey="pending" name="Pending" fill="#c7d2fe" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No assignment data yet" description="Create your first assignment to see group submission analytics." />}</section><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6"><h2 className="font-display text-lg font-extrabold">Group performance</h2><p className="mt-1 text-xs text-muted">Latest group activity</p><div className="mt-5 space-y-4">{(analytics?.groups || []).slice(0, 5).map(group => { const percent = group.assignment_count ? Math.round(group.submitted_count / group.assignment_count * 100) : 0; return <div key={group.id}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold">{group.name}</span><span className="text-xs font-semibold text-muted">{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} /></div><div className="mt-1 text-[11px] text-muted">{group.member_count} members · {group.submitted_count}/{group.assignment_count} tracked</div></div>; })}{!analytics?.groups?.length && <EmptyState title="No groups yet" description="Groups will appear here when students create them." />}</div></section></div>
    </> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="My group" value={groups[0]?.name || 'Not joined'} detail={groups[0] ? `${groups[0].member_count} group members` : 'Create a group to begin'} icon={Users} /><StatCard label="Assignments" value={assignments.length} detail="Available to your group" icon={BookOpen} tone="violet" /><StatCard label="Submitted" value={submitted} detail="Confirmed by your group" icon={CheckCircle2} tone="emerald" /><StatCard label="Pending" value={pending} detail="Still needs confirmation" icon={Clock3} tone="amber" /></div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_1fr]"><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-extrabold">Assignment progress</h2><p className="mt-1 text-xs text-muted">Your group's submission completion</p></div><span className="font-display text-2xl font-extrabold text-brand">{completion}%</span></div><div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${completion}%` }} /></div><div className="mt-3 flex justify-between text-xs text-muted"><span>{submitted} completed</span><span>{pending} remaining</span></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-4"><CheckCircle2 size={18} className="mb-2 text-emerald-600" /><div className="text-xl font-extrabold text-emerald-700">{submitted}</div><div className="text-xs text-emerald-700/70">Confirmed</div></div><div className="rounded-xl bg-amber-50 p-4"><Clock3 size={18} className="mb-2 text-amber-600" /><div className="text-xl font-extrabold text-amber-700">{pending}</div><div className="text-xs text-amber-700/70">To do</div></div></div></section><section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-extrabold">Coming up</h2><p className="mt-1 text-xs text-muted">Your next assignment deadlines</p></div><CalendarDays size={19} className="text-brand" /></div><div className="mt-4 space-y-3">{upcoming.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-brand"><BookOpen size={18} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.title}</div><div className="mt-1 text-xs text-muted">Due {dateLabel(item.due_date)}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.submitted ? 'Done' : 'Pending'}</span></div>)}{!upcoming.length && <EmptyState title="Nothing assigned yet" description="Assignments from your professor will show up here." />}</div></section></div>
    </>}
  </>;
}
