const STATUS_COLOR = {
  alert:       '#dc2626',
  offline:     '#374151',
  ok:          '#1e3a5f',
  vital:       '#1e3a5f',
  protected:   '#1e3a5f',
  sacrificable:'#1e3a5f',
};

const STATUS_STROKE = {
  alert:       '#fca5a5',
  offline:     '#6b7280',
  ok:          '#60a5fa',
  vital:       '#93c5fd',
  protected:   '#60a5fa',
  sacrificable:'#60a5fa',
};

const ZONES = [
  { id: 'passerelle',  label: 'PONT',        label2: 'VLAN 10', base: 'vital' },
  { id: 'laboratoire', label: 'LABORATOIRE', label2: 'VLAN 20', base: 'ok' },
  { id: 'support_vie', label: 'SUPPORT VIE', label2: 'VLAN 30', base: 'protected' },
  { id: 'loisirs',     label: 'LOISIRS',     label2: 'VLAN 40', base: 'sacrificable' },
];

const SHIP_PARTS = {
  passerelle: {
    path: 'M 720,250 L 620,180 L 580,250 L 620,320 Z',
    labelPos: [630, 230],
    impactX: 600,
  },
  laboratoire: {
    path: 'M 620,180 L 440,160 L 420,250 L 440,340 L 620,320 L 580,250 Z',
    labelPos: [520, 230],
    impactX: 450,
  },
  support_vie: {
    path: 'M 440,160 L 260,170 L 240,250 L 260,330 L 440,340 L 420,250 Z',
    labelPos: [340, 230],
    impactX: 270,
  },
  loisirs: {
    path: 'M 260,170 L 100,200 L 80,250 L 100,300 L 260,330 L 240,250 Z',
    labelPos: [175, 230],
    impactX: 110,
  },
};

const WINGS = [
  'M 260,170 L 200,130 L 80,110 L 80,160 L 160,165 L 240,170 Z',
  'M 260,330 L 200,370 L 80,390 L 80,340 L 160,335 L 240,330 Z',
];

const METRICS = [
  { key: 'temperature', label: 'TEMP',  unit: '°C',  warn: v => v > 35 },
  { key: 'humidity',    label: 'HUMID', unit: '%',   warn: v => v > 80 },
  { key: 'oxygen',      label: 'O₂',   unit: '%',   warn: v => v < 19.5 },
  { key: 'radiation',   label: 'RAD',  unit: 'μSv', warn: v => v > 1 },
];

function getColor(status, base, type) {
  const key = status && STATUS_COLOR[status] ? status : base;
  return type === 'fill' ? STATUS_COLOR[key] : STATUS_STROKE[key];
}

function ZoneMetrics({ zoneEnv, cx, cy }) {
  return (
    <g>
      {METRICS.map(({ key, label, unit, warn }, i) => {
        const val = zoneEnv?.[key];
        const alert = val != null && warn(val);
        const y = cy + i * 15;
        return (
          <g key={key}>
            <text x={cx - 2} y={y} textAnchor="end" fill="#64748b" style={{ fontSize: 8, fontFamily: 'monospace' }}>{label}</text>
            <text x={cx + 2} y={y} fill={alert ? '#f87171' : '#e2e8f0'} style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700 }}>
              {val != null ? `${val}${unit}` : '---'}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// L'astéroïde arrive du haut ou du bas selon la zone
const ASTEROID_DIR = {
  passerelle:  'top',
  laboratoire: 'bottom',
  support_vie: 'top',
  loisirs:     'bottom',
};

function AsteroidImpact({ part, zoneId }) {
  const cx     = part.impactX;
  const fromTop = ASTEROID_DIR[zoneId] === 'top';
  const startY = fromTop ? -60 : 560;
  const endY   = 250;

  // Flammes pointent vers le haut ou le bas (sens inverse du mouvement)
  const flamePoints1 = fromTop
    ? `-5,22 0,42 5,22`
    : `-5,-22 0,-42 5,-22`;
  const flameAnim1 = fromTop
    ? `-5,22 0,42 5,22; -5,22 0,58 5,22; -5,22 0,42 5,22`
    : `-5,-22 0,-42 5,-22; -5,-22 0,-58 5,-22; -5,-22 0,-42 5,-22`;
  const flamePoints2 = fromTop
    ? `-3,22 0,50 3,22`
    : `-3,-22 0,-50 3,-22`;
  const flameAnim2 = fromTop
    ? `-3,22 0,50 3,22; -3,22 0,65 3,22; -3,22 0,50 3,22`
    : `-3,-22 0,-50 3,-22; -3,-22 0,-65 3,-22; -3,-22 0,-50 3,-22`;

  return (
    <g>
      <animateMotion dur="2s" fill="freeze" path={`M ${cx},${startY} L ${cx},${endY}`} />
      <polygon fill="#f97316" opacity="0.95">
        <animate attributeName="points" values={flameAnim1} dur="0.3s" repeatCount="indefinite" />
      </polygon>
      <polygon fill="#fbbf24" opacity="0.8">
        <animate attributeName="points" values={flameAnim2} dur="0.25s" begin="0.05s" repeatCount="indefinite" />
      </polygon>
      <image href="/asteroide.png" width="44" height="44" x="-22" y="-22">
        <animateTransform attributeName="transform" type="rotate"
          from="0" to="360" dur="2s" repeatCount="1" additive="sum" />
      </image>
    </g>
  );
}

export default function ShipMap({ zones, env, asteroids }) {
  return (
    <div className="w-full max-w-5xl mx-auto p-6 rounded-xl">
      <svg viewBox="0 0 800 500" className="w-full h-auto">
        <defs>
          <clipPath id="ship-clip">
            <rect x="0" y="0" width="800" height="500" />
          </clipPath>
        </defs>

        {/* Voile sombre */}
        <rect x="0" y="0" width="800" height="500" fill="#000" opacity="0.2" />

        {/* Ailes */}
        {WINGS.map((d, i) => (
          <path key={i} d={d} fill="#0f2744" stroke="#334155" strokeWidth="1.5" />
        ))}

        {/* Flammes nacelle haute */}
        <g>
          <polygon points="80,115 30,128 80,141" fill="#f97316">
            <animate attributeName="points" values="80,115 30,128 80,141; 80,115 10,128 80,141; 80,115 30,128 80,141" dur="0.5s" repeatCount="indefinite" />
          </polygon>
          <polygon points="80,119 20,128 80,137" fill="#fbbf24" opacity="0.85">
            <animate attributeName="points" values="80,119 20,128 80,137; 80,119 4,128 80,137; 80,119 20,128 80,137" dur="0.4s" begin="0.1s" repeatCount="indefinite" />
          </polygon>
          <polygon points="80,123 10,128 80,133" fill="#fef08a" opacity="0.5">
            <animate attributeName="points" values="80,123 10,128 80,133; 80,123 -6,128 80,133; 80,123 10,128 80,133" dur="0.6s" begin="0.05s" repeatCount="indefinite" />
          </polygon>
        </g>

        {/* Flammes nacelle basse */}
        <g>
          <polygon points="80,345 30,358 80,371" fill="#f97316">
            <animate attributeName="points" values="80,345 30,358 80,371; 80,345 10,358 80,371; 80,345 30,358 80,371" dur="0.5s" begin="0.1s" repeatCount="indefinite" />
          </polygon>
          <polygon points="80,349 20,358 80,367" fill="#fbbf24" opacity="0.85">
            <animate attributeName="points" values="80,349 20,358 80,367; 80,349 4,358 80,367; 80,349 20,358 80,367" dur="0.4s" repeatCount="indefinite" />
          </polygon>
          <polygon points="80,353 10,358 80,363" fill="#fef08a" opacity="0.5">
            <animate attributeName="points" values="80,353 10,358 80,363; 80,353 -6,358 80,363; 80,353 10,358 80,363" dur="0.6s" begin="0.15s" repeatCount="indefinite" />
          </polygon>
        </g>

        {/* Zones réactives */}
        {ZONES.map(({ id, label, label2, base }) => {
          const status  = zones[id];
          const fill    = getColor(status, base, 'fill');
          const stroke  = getColor(status, base, 'stroke');
          const part    = SHIP_PARTS[id];
          const isAlert = status === 'alert' || asteroids?.[id];
          const [cx, cy] = part.labelPos;
          return (
            <g key={id}>
              <path
                d={part.path}
                stroke={stroke}
                strokeWidth="2"
                style={{ fill }}
              >
                {isAlert && (
                  <animate attributeName="fill" values="#dc2626;#450a0a;#dc2626" dur="1s" repeatCount="indefinite" />
                )}
              </path>
              <path d={part.path} fill="none" stroke="#1e40af" strokeWidth="0.5" opacity="0.4" />
              <text x={cx} y={cy - 10} textAnchor="middle" fill="white" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                {label}
              </text>
              <text x={cx} y={cy + 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" style={{ fontSize: 9, fontFamily: 'monospace' }}>
                {label2}
              </text>
              <ZoneMetrics zoneEnv={env?.[id]} cx={cx} cy={cy + 18} />
            </g>
          );
        })}

        {/* Astéroïdes */}
        <g clipPath="url(#ship-clip)">
          {asteroids && Object.entries(asteroids).map(([id, active]) =>
            active ? <AsteroidImpact key={id} part={SHIP_PARTS[id]} zoneId={id} /> : null
          )}
        </g>

        {/* Légende */}
        <g>
          <rect x="630" y="10" width="160" height="88" rx="6" fill="#0f172a" stroke="#1e40af" strokeWidth="1.5" />
          <text x="710" y="26" textAnchor="middle" fill="#93c5fd" style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 }}>LÉGENDE</text>
          <line x1="638" y1="32" x2="782" y2="32" stroke="#1e40af" strokeWidth="1" />
          {[
            { color: '#1e3a5f', border: '#60a5fa', label: 'Nominal',    y: 48 },
            { color: '#dc2626', border: '#fca5a5', label: 'Alerte',     y: 68 },
            { color: '#374151', border: '#6b7280', label: 'Hors ligne', y: 88 },
          ].map(({ color, border, label, y }) => (
            <g key={label}>
              <rect x="638" y={y - 9} width="12" height="12" rx="2" fill={color} stroke={border} strokeWidth="1.5" />
              <text x="656" y={y} fill="#e2e8f0" style={{ fontSize: 10, fontFamily: 'monospace' }}>{label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
