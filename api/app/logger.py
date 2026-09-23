import sqlite3
import json
import time
from datetime import datetime

DB_PATH = "leviathan.db"
MQTT_TOPIC = "vaisseau/journal"

def init_db():
    """Initialise la table SQLite pour le journal des incidents."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incident_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            zone TEXT,
            severity TEXT,
            rule_triggered TEXT,
            actions_executed TEXT,
            result TEXT,
            detection_time_ms INTEGER,
            resolution_time_ms INTEGER
        )
    ''')
    conn.commit()
    conn.close()

def log_incident(mqtt_client, zone, severity, rule, actions, result, t_start, t_end):
    """
    Enregistre l'incident dans SQLite et le diffuse en temps réel sur MQTT.
    t_start et t_end sont des timestamps (time.time()) pour calculer les métriques de soutenance.
    """
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # Calcul des temps pour les métriques
    detection_time_ms = int((t_start) * 1000) # À adapter selon la logique exacte de détection
    resolution_time_ms = int((t_end - t_start) * 1000)

    # 1. Persistance SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO incident_logs 
        (timestamp, zone, severity, rule_triggered, actions_executed, result, detection_time_ms, resolution_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (timestamp, zone, severity, rule, json.dumps(actions), result, detection_time_ms, resolution_time_ms))
    conn.commit()
    conn.close()

    # 2. Publication MQTT (Temps réel pour le dashboard React)
    payload = {
        "timestamp": timestamp,
        "zone": zone,
        "severity": severity,
        "rule": rule,
        "actions": actions,
        "result": result,
        "metrics": {
            "detection_time_ms": detection_time_ms,
            "resolution_time_ms": resolution_time_ms
        }
    }
    
    mqtt_client.publish(MQTT_TOPIC, json.dumps(payload))
    print(f"[JOURNAL] Incident {rule} sur {zone} enregistré. Résolution: {resolution_time_ms}ms")