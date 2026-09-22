'use client';
import { useState, useEffect } from 'react';

const NOMINAL = { passerelle: 'vital', laboratoire: 'ok', support_vie: 'protected', loisirs: 'sacrificable' };
const INITIAL = { ...NOMINAL };
const EMPTY_ENV = { temperature: null, humidity: null, oxygen: null, radiation: null };
const INITIAL_ENV = {
  passerelle: { ...EMPTY_ENV },
  laboratoire: { ...EMPTY_ENV },
  support_vie: { ...EMPTY_ENV },
  loisirs: { ...EMPTY_ENV },
};
const INITIAL_ASTEROIDS = { passerelle: false, laboratoire: false, support_vie: false, loisirs: false };
const ZONE_LIST = ['passerelle', 'laboratoire', 'support_vie', 'loisirs'];

const ZONE_MAP = {
  lab: 'laboratoire',
  laboratoire: 'laboratoire',
  life_support: 'support_vie',
  support_vie: 'support_vie',
  bridge: 'passerelle',
  passerelle: 'passerelle',
  leisure: 'loisirs',
  loisirs: 'loisirs',
};

const SCENARIO_META = {
  asteroid: { severity: 'red', label: 'Météorite', duration: 2200 },
  fire: { severity: 'red', label: 'Incendie', duration: 3200 },
  radiation: { severity: 'orange', label: 'Radiation', duration: 3500 },
};

function normalizeZone(zone) {
  if (!zone) return null;
  return ZONE_MAP[zone] ?? zone;
}

function shuffle(array) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickRandomZones(count) {
  const shuffled = shuffle(ZONE_LIST);
  return shuffled.slice(0, Math.max(1, Math.min(ZONE_LIST.length, count)));
}

function pushLog(setLogs, entry) {
  setLogs(prev => [{
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  }, ...prev].slice(0, 60));
}

export default function useShipStatus() {
  const [zones, setZones] = useState(INITIAL);
  const [logs, setLogs] = useState([]);
  const [env, setEnv] = useState(INITIAL_ENV);
  const [asteroids, setAsteroids] = useState(INITIAL_ASTEROIDS);
  const [alertTypes, setAlertTypes] = useState({
    passerelle: null,
    laboratoire: null,
    support_vie: null,
    loisirs: null,
  });

  const triggerScenario = (scenario = null) => {
    const scenarioKey = scenario || Object.keys(SCENARIO_META)[Math.floor(Math.random() * Object.keys(SCENARIO_META).length)];
    const config = SCENARIO_META[scenarioKey];
    if (!config) return;

    const impactedZones = pickRandomZones(1 + Math.floor(Math.random() * 3));
    const timestamp = new Date().toISOString();

    impactedZones.forEach((zone) => {
      setZones(prev => ({ ...prev, [zone]: 'alert' }));
      setAlertTypes(prev => ({ ...prev, [zone]: scenarioKey }));

      if (scenarioKey === 'asteroid') {
        setAsteroids(prev => ({ ...prev, [zone]: true }));
      }

      if (scenarioKey === 'fire') {
        setEnv(prev => ({
          ...prev,
          [zone]: {
            ...prev[zone],
            temperature: 45 + Math.random() * 18,
            oxygen: 15 + Math.random() * 5,
          },
        }));
      }

      if (scenarioKey === 'radiation') {
        setEnv(prev => ({
          ...prev,
          [zone]: {
            ...prev[zone],
            radiation: 2.2 + Math.random() * 3.8,
          },
        }));
      }

      pushLog(setLogs, {
        type: 'scenario',
        scenario: scenarioKey,
        zone,
        severity: config.severity,
        message: `${config.label} détecté${scenarioKey === 'fire' ? 'e' : ''} sur ${zone}`,
        timestamp,
      });

      setTimeout(() => {
        setZones(prev => ({ ...prev, [zone]: NOMINAL[zone] }));
        setAlertTypes(prev => ({ ...prev, [zone]: null }));
        if (scenarioKey === 'asteroid') {
          setAsteroids(prev => ({ ...prev, [zone]: false }));
        }
      }, config.duration);
    });
  };

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const targetZone = normalizeZone(data.zone);

      if (data.type === 'environment' && targetZone) {
        setEnv(prev => ({ ...prev, [targetZone]: { ...prev[targetZone], ...data } }));
      }

      if (data.type === 'asteroid' && targetZone) {
        setAsteroids(prev => ({ ...prev, [targetZone]: true }));
        setZones(prev => ({ ...prev, [targetZone]: 'alert' }));
        setAlertTypes(prev => ({ ...prev, [targetZone]: 'asteroid' }));
        pushLog(setLogs, {
          type: 'alert',
          scenario: 'asteroid',
          zone: targetZone,
          severity: 'red',
          message: data.message || 'Impact d’astéroïde détecté',
          timestamp: data.timestamp || new Date().toISOString(),
        });
        setTimeout(() => {
          setAsteroids(prev => ({ ...prev, [targetZone]: false }));
          setZones(prev => ({ ...prev, [targetZone]: NOMINAL[targetZone] }));
          setAlertTypes(prev => ({ ...prev, [targetZone]: null }));
        }, 2200);
      }

      if (data.type === 'alert' && targetZone) {
        const scenario = data.scenario || (data.zone === 'lab' ? 'fire' : 'radiation');
        setZones(prev => ({ ...prev, [targetZone]: 'alert' }));
        setAlertTypes(prev => ({ ...prev, [targetZone]: scenario }));
        if (scenario === 'fire') {
          setEnv(prev => ({ ...prev, [targetZone]: { ...prev[targetZone], temperature: 47, oxygen: 17.1 } }));
        }
        if (scenario === 'radiation') {
          setEnv(prev => ({ ...prev, [targetZone]: { ...prev[targetZone], radiation: 3.6 } }));
        }
        pushLog(setLogs, {
          type: 'alert',
          scenario,
          zone: targetZone,
          severity: data.severity || 'red',
          message: data.message || (scenario === 'fire' ? 'Incendie détecté' : 'Radiation détectée'),
          timestamp: data.timestamp || new Date().toISOString(),
        });
        setTimeout(() => {
          setZones(prev => ({ ...prev, [targetZone]: NOMINAL[targetZone] }));
          setAlertTypes(prev => ({ ...prev, [targetZone]: null }));
        }, 2500);
      }

      if (data.type === 'playbook_log') {
        pushLog(setLogs, data);
        if (data.message?.includes('coupé') || data.status === 'done') {
          const zoneMap = { 'lab-vlan20': 'laboratoire', 'loisirs-vlan40': 'loisirs' };
          const zone = zoneMap[data.pool];
          if (zone) setZones(prev => ({ ...prev, [zone]: 'offline' }));
        }
      }
    };

    return () => ws.close();
  }, []);

  return { zones, logs, env, asteroids, alertTypes, triggerScenario };
}
