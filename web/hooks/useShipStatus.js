'use client';
import { useState, useEffect } from 'react';

const INITIAL = { laboratoire: 'ok', loisirs: 'ok', passerelle: 'ok' };

export default function useShipStatus() {
  const [zones, setZones] = useState(INITIAL);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Alerte incendie
      if (data.type === 'alert' && data.zone === 'lab') {
        setZones(prev => ({ ...prev, laboratoire: 'alert' }));
      }

      // Log playbook : zone coupée
      if (data.type === 'playbook_log') {
        setLogs(prev => [data, ...prev].slice(0, 50));
        if (data.message?.includes('coupé') || data.status === 'done') {
          const zone = data.pool === 'lab-vlan20' ? 'laboratoire' : 'loisirs';
          setZones(prev => ({ ...prev, [zone]: 'offline' }));
        }
      }
    };

    return () => ws.close();
  }, []);

  return { zones, logs };
}
