import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">{eyebrow}</div><h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-[34px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>{action}</div>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'indigo' }) {
  const tones = { indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600' };
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft"><div className="flex items-start justify-between"><div><div className="text-sm font-medium text-muted">{label}</div><div className="mt-3 font-display text-3xl font-extrabold tracking-tight">{value ?? '—'}</div><div className="mt-1 text-xs text-muted">{detail}</div></div><div className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}><Icon size={20} /></div></div></div>;
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  const success = type === 'success';
  return <div className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{success ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <AlertCircle size={17} className="mt-0.5 shrink-0" />}{children}</div>;
}

export function Loading({ label = 'Loading workspace' }) { return <div className="flex items-center justify-center gap-3 py-20 text-sm font-medium text-muted"><LoaderCircle className="animate-spin text-brand" size={20} />{label}</div>; }

export function EmptyState({ title, description }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><AlertCircle size={21} /></div><div className="font-bold">{title}</div><p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p></div>; }
