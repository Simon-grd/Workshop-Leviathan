'use client';
import useShipStatus from '../../hooks/useShipStatus';
import ShipMap from '../../components/ShipMap';
import EventLog from '../../components/EventLog';

const SCENARIOS = [
  { key: 'asteroid', label: 'Météorite' },
  { key: 'fire', label: 'Incendie' },
  { key: 'radiation', label: 'Radiation' },
];

export default function ShipPage() {
  const { zones, logs, env, asteroids, alertTypes, triggerScenario } = useShipStatus();
  const activeScenarios = new Set(Object.values(alertTypes || {}).filter(Boolean));

  return (
    <main
      className="min-h-screen text-slate-100 flex flex-col p-6 gap-6"
      style={{ backgroundImage: 'url(/space.jpg)', backgroundSize: '120%', animation: 'pan-circle 8s linear infinite' }}
    >
      <div className="absolute inset-0 bg-black/50 -z-10" />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-mono font-bold tracking-widest text-slate-300">
          LÉVIATHAN — CONTRÔLE VAISSEAU
        </h1>

        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map(({ key, label }) => {
            const isActive = activeScenarios.has(key === 'asteroid' ? 'asteroid' : key);

            return (
              <button
                key={key}
                type="button"
                onClick={() => triggerScenario(key)}
                className={[
                  'rounded border px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition',
                  isActive
                    ? 'border-red-400 bg-red-500/20 text-red-100 shadow-[0_0_12px_rgba(248,113,113,0.8)]'
                    : 'border-sky-500/50 bg-slate-900/80 text-sky-200 hover:border-sky-300 hover:bg-slate-800',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ShipMap zones={zones} env={env} asteroids={asteroids} alertTypes={alertTypes} />

      <section className="bg-slate-900/70 backdrop-blur-sm rounded-lg p-4">
        <h2 className="text-sm font-mono text-slate-400 mb-3 uppercase tracking-wider">
          Journal des événements
        </h2>
        <EventLog logs={logs} />
      </section>
    </main>
  );
}
