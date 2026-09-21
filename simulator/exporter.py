"""Simulateur d'énergie : expose battery_percent et power_draw_watts pour Prometheus.

Contrôle en démo : GET http://localhost:8001/set?battery=15
"""
import random
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from prometheus_client import Gauge, start_http_server

METRICS_PORT = 8000
CONTROL_PORT = 8001

battery = Gauge("battery_percent", "Niveau de batterie (0-100)")
power = Gauge("power_draw_watts", "Consommation instantanée (W)")

state = {"battery": 100.0}
lock = threading.Lock()


class Control(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/set":
            try:
                value = float(parse_qs(url.query)["battery"][0])
                with lock:
                    state["battery"] = max(0.0, min(100.0, value))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(f"battery={state['battery']}\n".encode())
                return
            except (KeyError, ValueError):
                pass
        self.send_response(400)
        self.end_headers()

    def log_message(self, *args):  # silence
        pass


def main():
    start_http_server(METRICS_PORT)
    threading.Thread(
        target=HTTPServer(("0.0.0.0", CONTROL_PORT), Control).serve_forever,
        daemon=True,
    ).start()
    print(f"Métriques : :{METRICS_PORT}/metrics · Contrôle : :{CONTROL_PORT}/set?battery=N")

    while True:
        with lock:
            state["battery"] = max(0.0, state["battery"] - 0.01)  # décharge lente naturelle
            battery.set(state["battery"])
        power.set(random.uniform(80, 120))
        time.sleep(1)


if __name__ == "__main__":
    main()
