"""Hyperviseur Léviathan : lit les métriques, applique les seuils, coupe / migre.

Usage : python main.py [--dry-run]
"""
import argparse
import json
import logging
import os
import time
from datetime import datetime, timezone

import docker
import requests
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hypervisor")


def audit(action: str, **details):
    """Journal d'audit en JSON (une ligne par action)."""
    log.info("AUDIT %s", json.dumps(
        {"ts": datetime.now(timezone.utc).isoformat(), "action": action, **details}))


def query_prometheus(base_url: str, expr: str, timeout: int = 3):
    """Retourne la valeur scalaire de la requête, ou None si indisponible."""
    try:
        r = requests.get(f"{base_url}/api/v1/query", params={"query": expr}, timeout=timeout)
        r.raise_for_status()
        result = r.json()["data"]["result"]
        return float(result[0]["value"][1]) if result else None
    except (requests.RequestException, KeyError, ValueError, IndexError) as exc:
        log.warning("Prometheus injoignable : %s", exc)
        return None


class Hypervisor:
    def __init__(self, cfg: dict, dry_run: bool):
        self.cfg = cfg
        self.dry_run = dry_run
        self.client = docker.from_env()
        self.applied: set[int] = set()          # niveaux déjà appliqués
        self.counters: dict[int, int] = {}      # lectures consécutives par niveau

    def stop_tier(self, tier: str):
        for c in self.client.containers.list(filters={"label": f"tier={tier}"}):
            audit("stop_container", tier=tier, container=c.name, dry_run=self.dry_run)
            if not self.dry_run:
                c.stop(timeout=5)

    def migrate_databases(self):
        # TODO (mercredi) : vérifier lag de réplication ≈ 0, promouvoir la réplique
        # côté Alpine, mettre à jour la config des services vitaux, vérifier la santé.
        audit("migrate_databases", status="not_implemented", dry_run=self.dry_run)

    def apply_level(self, level: dict):
        for tier in level.get("stop_tiers", []):
            self.stop_tier(tier)
        if level.get("migrate_databases"):
            self.migrate_databases()

    def evaluate(self, battery: float):
        needed = self.cfg["consecutive_readings"]
        hyst = self.cfg["hysteresis"]
        for level in self.cfg["levels"]:
            threshold = level["below"]
            if battery < threshold:
                self.counters[threshold] = self.counters.get(threshold, 0) + 1
                if self.counters[threshold] >= needed and threshold not in self.applied:
                    audit("level_triggered", threshold=threshold, battery=battery)
                    self.apply_level(level)
                    self.applied.add(threshold)
            else:
                self.counters[threshold] = 0
                if battery > threshold + hyst:
                    self.applied.discard(threshold)

    def run(self):
        log.info("Hyperviseur démarré (dry_run=%s)", self.dry_run)
        while True:
            battery = query_prometheus(self.cfg["prometheus_url"], "battery_percent")
            if battery is None:
                log.warning("Mode dégradé : aucune action tant que les métriques manquent")
            else:
                self.evaluate(battery)
            time.sleep(self.cfg["poll_interval_seconds"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    dry_run = args.dry_run or os.getenv("DRY_RUN", "true").lower() == "true"

    with open(os.getenv("CONFIG_PATH", "config.yaml")) as f:
        cfg = yaml.safe_load(f)
    if os.getenv("PROMETHEUS_URL"):
        cfg["prometheus_url"] = os.environ["PROMETHEUS_URL"]

    Hypervisor(cfg, dry_run).run()


if __name__ == "__main__":
    main()
