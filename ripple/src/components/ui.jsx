import { AlertCircle } from 'lucide-react';

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <span className="rounded-full bg-coral-soft p-3 text-coral"><Icon size={22} /></span>
      <p className="font-serif text-base">{title}</p>
      {hint && <p className="max-w-[16rem] text-sm text-mute">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ title, children, actions }) {
  return (
    <div role="alert" className="card border-bad/30 bg-[#FBF1EE]">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium text-bad"><AlertCircle size={16} /> {title}</p>
      <p className="mb-3 text-sm text-ink/80">{children}</p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
