'use client';
import { useState, useEffect } from 'react';

const NOMINAL = { passerelle: 'vital', laboratoire: 'ok', support_vie: 'protected', loisirs: 'sacrificable' };
const INITIAL  = { ...NOMINAL };
const EMPTY_ENV = { temperature: null, humidity: null, oxygen: null, radiation: null };
const INITIAL_ENV = {
  passerelle: { ...EMPTY_ENV },
  laboratoire: { ...EMPTY_ENV },
  support_vie: { ...EMPTY_ENV },
  loisirs:     { ...EMPTY_ENV },
};
const INITIAL_ASTEROIDS = { passerelle: false, laboratoire: false, support_vie: false, loisirs: false };

export default function useShipStatus() {
  const [zones, setZones] = useState(INITIAL);
  const [logs, setLogs] = useState([]);
  const [env, setEnv] = useState(INITIAL_ENV);
  const [asteroids, setAsteroids] = useState(INITIAL_ASTEROIDS);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Données environnementales
      if (data.type === 'environment' && data.zone) {
        setEnv(prev => ({ ...prev, [data.zone]: { ...prev[data.zone], ...data } }));
      }

      // Alerte astéroïde
      if (data.type === 'asteroid' && data.zone) {
        setAsteroids(prev => ({ ...prev, [data.zone]: true }));
        setZones(prev => ({ ...prev, [data.zone]: 'alert' }));
        setTimeout(() => {
          setAsteroids(prev => ({ ...prev, [data.zone]: false }));
          setZones(prev => ({ ...prev, [data.zone]: NOMINAL[data.zone] }));
        }, 2000);
      }

      // Alerte incendie
      if (data.type === 'alert' && data.zone === 'lab') {
        setZones(prev => ({ ...prev, laboratoire: 'alert' }));
      }

      // Log playbook : zone coupée
      if (data.type === 'playbook_log') {
        setLogs(prev => [data, ...prev].slice(0, 50));
        if (data.message?.includes('coupé') || data.status === 'done') {
          const zoneMap = { 'lab-vlan20': 'laboratoire', 'loisirs-vlan40': 'loisirs' };
          const zone = zoneMap[data.pool];
          if (zone) setZones(prev => ({ ...prev, [zone]: 'offline' }));
        }
      }
    };

    return () => ws.close();
  }, []);

  return { zones, logs, env, asteroids };
}
