'use client';
import useShipStatus from '../../hooks/useShipStatus';
import ShipMap from '../../components/ShipMap';
import EventLog from '../../components/EventLog';

export default function ShipPage() {
  const { zones, logs } = useShipStatus();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <h1 className="text-xl font-mono font-bold tracking-widest text-slate-300">
        LÉVIATHAN — CONTRÔLE VAISSEAU
      </h1>

      <ShipMap zones={zones} />

      <section className="bg-slate-900 rounded-lg p-4">
        <h2 className="text-sm font-mono text-slate-400 mb-3 uppercase tracking-wider">
          Journal des événements
        </h2>
        <EventLog logs={logs} />
      </section>
    </main>
  );
}
