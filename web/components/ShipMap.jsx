const STATUS = {
  alert:   'fill-red-600 animate-emergency-blink',
  offline: 'fill-gray-700',
  ok:      'fill-emerald-500',
};

const ZONES = [
  { id: 'laboratoire', label: 'LABO',      x: 160, y: 150 },
  { id: 'loisirs',     label: 'LOISIRS',   x: 340, y: 150 },
  { id: 'passerelle',  label: 'PASSERELLE', x: 520, y: 150 },
];

export default function ShipMap({ zones }) {
  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 p-4 rounded-lg shadow-2xl">
      <svg viewBox="0 0 800 400" className="w-full h-auto">
        {/* Coque */}
        <path
          d="M50,200 C50,100 750,100 750,200 C750,300 50,300 50,200 Z"
          className="fill-slate-800 stroke-slate-500 stroke-2"
        />
        {ZONES.map(({ id, label, x, y }) => (
          <g key={id} className={STATUS[zones[id]] ?? STATUS.ok}>
            <rect x={x} y={y} width={120} height={80} rx="4" />
            <text
              x={x + 60}
              y={y + 45}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-xs font-mono"
              style={{ fontSize: 11 }}
            >
              {label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
