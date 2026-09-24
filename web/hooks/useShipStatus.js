'use client';
import { useState, useEffect, useRef } from 'react';

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
  sabotage: { severity: 'red', label: 'Sabotage', duration: 3200 },
  oxygene: { severity: 'orange', label: 'Oxygène bas', duration: 3500 },
};

// Durée d'affichage d'une alerte sur la carte (≥ 5 s pour l'animation sabotage).
const ALERTE_AFFICHAGE_MS = 6000;

// L'API du vaisseau : les scénarios y sont joués POUR DE VRAI.
const API = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.33:8000';

// Un incident dure tant que le moteur ne l'a pas levé. Les minuteries de
// SCENARIO_META ne servent qu'à l'animation d'entrée ; l'état de la zone,
// lui, est piloté par `incident_debut` / `incident_fin`.
const SCENARIO_VERS_API = {
  asteroid: 'meteorite', fire: 'incendie', radiation: 'radiation',
  sabotage: 'sabotage', oxygene: 'oxygene',
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
  // Les animations de Simon remettent la zone au nominal au bout de 2 à 3,5 s.
  // C'est juste pour un effet visuel, mais faux pour un incident qui dure :
  // la zone repassait au vert alors que le moteur la tenait encore confinée.
  // Ces deux registres retiennent l'état durable ; les minuteries les
  // consultent avant de rétablir quoi que ce soit.
  const incidentsRef = useRef({});   // zone -> scenario tant que l'incident dure
  const horsLigneRef = useRef({});   // zone -> true tant qu'un secteur est coupé
  const finAffichageRef = useRef({}); // zone -> minuterie d'effacement de l'alerte

  // L'alerte (zone rouge + effet) ne reste affichée que ALERTE_AFFICHAGE_MS,
  // même si le moteur n'a pas encore levé l'incident : un secteur coupé
  // repasse alors en « hors ligne », pas au vert.
  const programmerFinAffichage = (zone, setZones, setAlertTypes) => {
    clearTimeout(finAffichageRef.current[zone]);
    finAffichageRef.current[zone] = setTimeout(() => {
      delete finAffichageRef.current[zone];
      setAlertTypes(prev => ({ ...prev, [zone]: null }));
      setZones(prev => ({ ...prev, [zone]: horsLigneRef.current[zone] ? 'offline' : NOMINAL[zone] }));
    }, ALERTE_AFFICHAGE_MS);
  };

  const retablir = (zone, setZones, setAlertTypes) => {
    if (incidentsRef.current[zone]) return;          // incident toujours en cours
    if (horsLigneRef.current[zone]) {
      setZones(prev => ({ ...prev, [zone]: 'offline' }));
      return;
    }
    setZones(prev => ({ ...prev, [zone]: NOMINAL[zone] }));
    if (setAlertTypes) setAlertTypes(prev => ({ ...prev, [zone]: null }));
  };

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

  // Déclenche un incident réel via l'API : le moteur agira sur les conteneurs.
  const declencherReel = async (scenarioKey, zone) => {
    const type = SCENARIO_VERS_API[scenarioKey];
    if (!type) return false;
    try {
      const r = await fetch(`${API}/api/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone, type, actif: true }),
      });
      return r.ok;
    } catch {
      return false;
    }
  };

  const jouerScenario = async (nom) => {
    try {
      const r = await fetch(`${API}/api/scenario/${nom}`, { method: 'POST' });
      return r.ok;
    } catch {
      return false;
    }
  };

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
        retablir(zone, setZones, setAlertTypes);
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
          retablir(targetZone, setZones, setAlertTypes);
        }, 2200);
      }

      if (data.type === 'alert' && targetZone) {
        const scenario = data.scenario || (data.zone === 'lab' ? 'fire' : 'radiation');
        setZones(prev => ({ ...prev, [targetZone]: 'alert' }));
        setAlertTypes(prev => ({ ...prev, [targetZone]: scenario }));
        // Aucune valeur inventée ici : la télémétrie réelle du vaisseau
        // arrive par les messages `environment` du traducteur MQTT. Inventer
        // 47 °C affichait un chiffre faux avec l'aplomb d'une mesure.
        pushLog(setLogs, {
          type: 'alert',
          scenario,
          zone: targetZone,
          severity: data.severity || 'red',
          message: data.message || (scenario === 'fire' ? 'Incendie détecté' : 'Radiation détectée'),
          timestamp: data.timestamp || new Date().toISOString(),
        });
        setTimeout(() => {
          retablir(targetZone, setZones, setAlertTypes);
        }, 2500);
      }

      if (data.type === 'playbook_log' && data.step === 'incident_debut' && targetZone) {
        incidentsRef.current[targetZone] = data.scenario || 'fire';
        setZones(prev => ({ ...prev, [targetZone]: 'alert' }));
        setAlertTypes(prev => ({ ...prev, [targetZone]: data.scenario || 'fire' }));
        programmerFinAffichage(targetZone, setZones, setAlertTypes);
        pushLog(setLogs, { ...data, type: 'alert' });
        return;
      }

      if (data.type === 'playbook_log' && data.step === 'incident_fin' && targetZone) {
        delete incidentsRef.current[targetZone];
        clearTimeout(finAffichageRef.current[targetZone]);
        delete finAffichageRef.current[targetZone];
        setAlertTypes(prev => ({ ...prev, [targetZone]: null }));
        retablir(targetZone, setZones, setAlertTypes);
        pushLog(setLogs, data);
        return;
      }

      if (data.type === 'playbook_log') {
        pushLog(setLogs, data);
        // `pool` n'existe que pour deux secteurs ; `zone` est fourni par
        // l'adaptateur de l'API pour les quatre.
        const zoneMap = { 'lab-vlan20': 'laboratoire', 'loisirs-vlan40': 'loisirs' };
        const zone = zoneMap[data.pool] ?? normalizeZone(data.zone);
        if (zone && NOMINAL[zone]) {
          if (data.step === 'stop_ct' || data.message?.includes('coupé')) {
            horsLigneRef.current[zone] = true;
            setZones(prev => ({ ...prev, [zone]: 'offline' }));
          } else if (data.step === 'start_ct' || data.message?.includes('rétabli')) {
            delete horsLigneRef.current[zone];
            // Retour au nominal quand le moteur rallume le secteur.
            setZones(prev => ({ ...prev, [zone]: NOMINAL[zone] }));
          }
        }
      }
    };

    return () => ws.close();
  }, []);

  return { zones, logs, env, asteroids, alertTypes, triggerScenario,
           declencherReel, jouerScenario };
}
