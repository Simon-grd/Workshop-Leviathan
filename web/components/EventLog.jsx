const SEVERITY = {
  red:    'text-red-400',
  orange: 'text-orange-400',
  green:  'text-emerald-400',
};

export default function EventLog({ logs }) {
  if (!logs.length) return (
    <p className="text-slate-500 text-sm font-mono">En attente d'événements…</p>
  );

  return (
    <ul className="space-y-1 font-mono text-sm max-h-64 overflow-y-auto">
      {logs.map((log, i) => (
        <li key={i} className={`${SEVERITY[log.severity] ?? 'text-slate-300'}`}>
          <span className="text-slate-500 mr-2">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          {log.message}
        </li>
      ))}
    </ul>
  );
}
