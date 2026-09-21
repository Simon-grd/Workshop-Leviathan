'use client';
import useShipStatus from '../../hooks/useShipStatus';
import ShipMap from '../../components/ShipMap';
import EventLog from '../../components/EventLog';

export default function ShipPage() {
  const { zones, logs, env, asteroids } = useShipStatus();

  return (
    <main
      className="min-h-screen text-slate-100 flex flex-col p-6 gap-6"
      style={{ backgroundImage: 'url(/space.jpg)', backgroundSize: '120%', animation: 'pan-circle 8s linear infinite' }}
    >
      <div className="absolute inset-0 bg-black/50 -z-10" />

      <h1 className="text-xl font-mono font-bold tracking-widest text-slate-300">
        LÉVIATHAN — CONTRÔLE VAISSEAU
      </h1>

      <ShipMap zones={zones} env={env} asteroids={asteroids} />

      <section className="bg-slate-900/70 backdrop-blur-sm rounded-lg p-4">
        <h2 className="text-sm font-mono text-slate-400 mb-3 uppercase tracking-wider">
          Journal des événements
        </h2>
        <EventLog logs={logs} />
      </section>
    </main>
  );
}
