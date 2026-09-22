'use client';
import { useRef, useState, useEffect } from 'react';

const STATUS_COLOR = {
  alert: '#dc2626',
  offline: '#374151',
  ok: '#1e3a5f',
  vital: '#1e3a5f',
  protected: '#1e3a5f',
  sacrificable: '#1e3a5f',
};

const STATUS_STROKE = {
  alert: '#fca5a5',
  offline: '#6b7280',
  ok: '#60a5fa',
  vital: '#93c5fd',
  protected: '#60a5fa',
  sacrificable: '#60a5fa',
};

const ZONES = [
  { id: 'passerelle', label: 'PONT', label2: '', base: 'vital' },
  { id: 'laboratoire', label: 'LABORATOIRE', label2: '', base: 'ok' },
  { id: 'support_vie', label: 'SUPPORT VIE', label2: '', base: 'protected' },
  { id: 'loisirs', label: 'LOISIRS', label2: '', base: 'sacrificable' },
];

const SHIP_PARTS = {
  passerelle: { path: 'M 720,250 L 620,180 L 580,250 L 620,320 Z', labelPos: [630, 230] },
  laboratoire: { path: 'M 620,180 L 440,160 L 420,250 L 440,340 L 620,320 L 580,250 Z', labelPos: [520, 230] },
  support_vie: { path: 'M 440,160 L 260,170 L 240,250 L 260,330 L 440,340 L 420,250 Z', labelPos: [340, 230] },
  loisirs: { path: 'M 260,170 L 100,200 L 80,250 L 100,300 L 260,330 L 240,250 Z', labelPos: [175, 230] },
};

const WINGS = [
  'M 260,170 L 200,130 L 80,110 L 80,160 L 160,165 L 240,170 Z',
  'M 260,330 L 200,370 L 80,390 L 80,340 L 160,335 L 240,330 Z',
];

const METRICS = [
  { key: 'temperature', label: 'TEMP', unit: '°C', warn: v => v > 35 },
  { key: 'humidity', label: 'HUMID', unit: '%', warn: v => v > 80 },
  { key: 'oxygen', label: 'O₂', unit: '%', warn: v => v < 19.5 },
  { key: 'radiation', label: 'RAD', unit: 'μSv', warn: v => v > 1 },
];

const ZONE_X_FRAC = { passerelle: 630 / 800, laboratoire: 520 / 800, support_vie: 340 / 800, loisirs: 175 / 800 };
const ZONE_Y_FRAC = 250 / 500;
const ASTEROID_DIR = { passerelle: 'top', laboratoire: 'bottom', support_vie: 'top', loisirs: 'bottom' };

function getColor(status, base, type) {
  const key = status && STATUS_COLOR[status] ? status : base;
  return type === 'fill' ? STATUS_COLOR[key] : STATUS_STROKE[key];
}

function formatMetricValue(value) {
  if (value == null || Number.isNaN(Number(value))) return '---';
  return Number(value).toFixed(2);
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
              {val != null ? `${formatMetricValue(val)}${unit}` : '---'}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ZoneAlertEffects({ zoneId, alertType, labelPos }) {
  const [cx, cy] = labelPos;

  if (alertType === 'fire') {
    // Flammes plus espacées pour couvrir le sas sans en sortir
    const flames = [
      { id: 'center', dx: 0, dy: 6, scale: 1, durationOffset: 0 },
      { id: 'left', dx: -38, dy: 16, scale: 0.75, durationOffset: 0.15 },
      { id: 'right', dx: 40, dy: 12, scale: 0.85, durationOffset: 0.25 },
      { id: 'topLeft', dx: -25, dy: -18, scale: 0.65, durationOffset: 0.1 },
      { id: 'topRight', dx: 28, dy: -15, scale: 0.7, durationOffset: 0.2 },
    ];

    return (
      <g transform={`translate(${cx} ${cy})`}>
        {/* Aura de chaleur agrandie proportionnellement à l'espacement */}
        <circle cx="0" cy="8" r="60" fill="rgba(251, 146, 60, 0.12)" stroke="rgba(251, 146, 60, 0.5)" strokeWidth="2">
          <animate attributeName="r" values="50;65;50" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.45;0.9;0.45" dur="1.2s" repeatCount="indefinite" />
        </circle>

        {flames.map(({ id, dx, dy, scale, durationOffset }) => (
          <g key={id} transform={`translate(${dx} ${dy}) scale(${scale})`}>
            <path d="M -18,18 Q 0,-34 18,18 Q 0,46 -18,18" fill="#f97316" opacity="0.95">
              <animate attributeName="opacity" values="0.7;1;0.8;1;0.7" dur={`${0.8 + durationOffset}s`} repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="scale" values="1 1; 1.18 1.3; 0.9 0.95; 1.1 1.18; 1 1" dur={`${0.8 + durationOffset}s`} repeatCount="indefinite" />
            </path>

            <path d="M -12,14 Q 0,-20 12,14 Q 0,38 -12,14" fill="#fb923c" opacity="0.9">
              <animate attributeName="opacity" values="0.6;1;0.75;1;0.6" dur={`${0.7 + durationOffset}s`} repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="scale" values="1 1; 1.22 1.35; 0.85 0.95; 1.15 1.25; 1 1" dur={`${0.7 + durationOffset}s`} repeatCount="indefinite" />
            </path>

            <path d="M -8,12 Q 0,-6 8,12 Q 0,30 -8,12" fill="#facc15" opacity="0.8">
              <animate attributeName="opacity" values="0.45;1;0.55;1;0.45" dur={`${0.6 + durationOffset}s`} repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="scale" values="1 1; 1.28 1.45; 0.82 0.9; 1.18 1.3; 1 1" dur={`${0.6 + durationOffset}s`} repeatCount="indefinite" />
            </path>
          </g>
        ))}
      </g>
    );
  }

  if (alertType === 'radiation') {
    return (
      <g>
        {[20, 34, 48].map((radius, index) => (
          <circle
            key={radius}
            cx={cx}
            cy={cy + 22}
            r={radius}
            fill="none"
            stroke="rgba(45, 212, 191, 0.7)"
            strokeWidth="1.5"
            opacity={0.9 - index * 0.25}
          >
            <animate attributeName="r" values={`${radius};${radius + 8};${radius}`} dur="2.2s" begin={`${index * 0.3}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.2s" begin={`${index * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </g>
    );
  }

  if (alertType === 'asteroid') {
    return (
      <g>
        <circle cx={cx} cy={cy + 18} r="22" fill="rgba(252, 211, 77, 0.2)" stroke="rgba(252, 211, 77, 0.8)" strokeWidth="1.5">
          <animate attributeName="r" values="18;26;18" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
    );
  }

  return null;
}

function AsteroidImpact({ zoneId, impactX, impactY }) {
  const fromTop = ASTEROID_DIR[zoneId] === 'top';
  const SIZE = 52;
  const startY = fromTop ? -SIZE : window.innerHeight;
  const dy = impactY - startY;

  const common = {
    position: 'fixed',
    pointerEvents: 'none',
    animation: 'asteroid-move 2s ease-in forwards',
    '--dy': `${dy}px`,
  };

  return (
    <>
      <div style={{
        ...common,
        zIndex: 48,
        left: impactX - 34,
        top: fromTop ? startY - 36 : startY + SIZE - 18,
        width: 68,
        height: 68,
        background: 'radial-gradient(circle, rgba(254, 240, 138, 0.9) 0%, rgba(249, 115, 22, 0.55) 38%, rgba(0,0,0,0) 72%)',
        borderRadius: '50%',
        filter: 'blur(10px)',
        opacity: 0.7,
      }} />
      <img src="/asteroide.png" alt="" style={{
        ...common,
        zIndex: 52,
        left: impactX - SIZE / 2,
        top: startY,
        width: SIZE,
        height: SIZE,
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 12px rgba(251, 146, 60, 0.9))',
      }} />
    </>
  );
}

function RadiationMarker({ zoneId, x, y }) {
  const orbiters = Array.from({ length: 4 }, (_, index) => {
    const angle = (index / 4) * Math.PI * 2;
    const radius = 18 + (index % 2) * 8;
    return {
      left: x + Math.cos(angle) * radius,
      top: y + Math.sin(angle) * radius,
      size: 26 + (index % 2) * 10,
      delay: `${index * 0.28}s`,
      duration: `${2.3 + (index % 2) * 0.4}s`,
    };
  });

  return (
    <>
      <style>{`
        @keyframes radiationZoom {
          0% { transform: scale(0.75) rotate(0deg); opacity: 0.55; }
          30% { transform: scale(1.18) rotate(8deg); opacity: 1; }
          60% { transform: scale(0.96) rotate(-8deg); opacity: 0.9; }
          100% { transform: scale(1.3) rotate(0deg); opacity: 0.75; }
        }
      `}</style>

      {orbiters.map((orbiter, index) => (
        <div
          key={`${zoneId}-radiation-${index}`}
          style={{
            position: 'fixed',
            left: orbiter.left - orbiter.size / 2,
            top: orbiter.top - orbiter.size / 2,
            width: orbiter.size,
            height: orbiter.size,
            zIndex: 40,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 14px rgba(34, 197, 94, 0.8))',
            animation: `radiationZoom ${orbiter.duration} ease-in-out infinite`,
            animationDelay: orbiter.delay,
          }}
        >
          <img src="/radioactif.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ))}
    </>
  );
}

export default function ShipMap({ zones, env, asteroids, alertTypes }) {
  const svgRef = useRef(null);
  const previousAsteroidStateRef = useRef(false);
  const [impacts, setImpacts] = useState({});
  const [shipImpactPulse, setShipImpactPulse] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pos = {};
    for (const [id, xFrac] of Object.entries(ZONE_X_FRAC)) {
      pos[id] = {
        x: rect.left + xFrac * rect.width,
        y: rect.top + ZONE_Y_FRAC * rect.height,
      };
    }
    setImpacts(pos);
  }, []);

  useEffect(() => {
    const activeAsteroids = Object.values(asteroids || {}).some(Boolean);

    if (previousAsteroidStateRef.current && !activeAsteroids) {
      setShipImpactPulse(true);
      const stopImpact = window.setTimeout(() => setShipImpactPulse(false), 450);
      return () => clearTimeout(stopImpact);
    }

    if (!activeAsteroids) {
      setShipImpactPulse(false);
    }

    previousAsteroidStateRef.current = activeAsteroids;
    return undefined;
  }, [asteroids]);

  return (
    <div
      className="w-full max-w-5xl mx-auto p-6 rounded-xl"
      style={{
        animation: shipImpactPulse ? 'ship-tangage 0.7s ease-in-out 1' : 'none',
        transformOrigin: 'center center',
      }}
    >
      <svg ref={svgRef} viewBox="0 0 800 500" className="w-full h-auto">
        <rect x="0" y="0" width="800" height="500" fill="#000" opacity="0.2" />

        {WINGS.map((d, i) => (
          <path key={i} d={d} fill="#0f2744" stroke="#334155" strokeWidth="1.5" />
        ))}

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

        {ZONES.map(({ id, label, label2, base }) => {
          const status = zones[id];
          const fill = getColor(status, base, 'fill');
          const stroke = getColor(status, base, 'stroke');
          const part = SHIP_PARTS[id];
          const isAlert = status === 'alert' || asteroids?.[id];
          const [cx, cy] = part.labelPos;
          return (
            <g key={id}>
              <path d={part.path} stroke={stroke} strokeWidth="2" style={{ fill }}>
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
              <ZoneAlertEffects zoneId={id} alertType={alertTypes?.[id]} labelPos={part.labelPos} />
              <ZoneMetrics zoneEnv={env?.[id]} cx={cx} cy={cy + 8} />
            </g>
          );
        })}

        <g>
          <rect x="630" y="10" width="160" height="88" rx="6" fill="#0f172a" stroke="#1e40af" strokeWidth="1.5" />
          <text x="710" y="26" textAnchor="middle" fill="#93c5fd" style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 }}>LÉGENDE</text>
          <line x1="638" y1="32" x2="782" y2="32" stroke="#1e40af" strokeWidth="1" />
          {[
            { color: '#1e3a5f', border: '#60a5fa', label: 'Nominal', y: 48 },
            { color: '#dc2626', border: '#fca5a5', label: 'Alerte', y: 68 },
            { color: '#374151', border: '#6b7280', label: 'Hors ligne', y: 88 },
          ].map(({ color, border, label, y }) => (
            <g key={label}>
              <rect x="638" y={y - 9} width="12" height="12" rx="2" fill={color} stroke={border} strokeWidth="1.5" />
              <text x="656" y={y} fill="#e2e8f0" style={{ fontSize: 10, fontFamily: 'monospace' }}>{label}</text>
            </g>
          ))}
        </g>
      </svg>

      {asteroids && Object.entries(asteroids).map(([id, active]) =>
        active && impacts[id]
          ? <AsteroidImpact key={id} zoneId={id} impactX={impacts[id].x} impactY={impacts[id].y} />
          : null
      )}

      {alertTypes && Object.entries(alertTypes).map(([id, type]) => {
        if (type !== 'radiation' || !impacts[id]) return null;
        return <RadiationMarker key={`${id}-radiation`} zoneId={id} x={impacts[id].x} y={impacts[id].y} />;
      })}
    </div>
  );
}