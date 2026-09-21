"""Terminal de commande manuel : FastAPI + WebSocket + double authentification.

Squelette : les routes suivent docs/api-contract.md.
"""
from fastapi import FastAPI, HTTPException, WebSocket

app = FastAPI(title="Léviathan Terminal")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
def login():
    # TODO : vérifier le mot de passe (argon2), renvoyer un jeton intermédiaire
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.post("/2fa")
def two_factor():
    # TODO : vérifier le TOTP (pyotp), ouvrir la session (JWT à expiration courte)
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.get("/status")
def status():
    # TODO : interroger l'hyperviseur (état des conteneurs par tier)
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.post("/restart")
def restart():
    # TODO : officier 1 → créer une demande "pending"
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.post("/approve/{request_id}")
def approve(request_id: str):
    # TODO : officier 2 (≠ officier 1) + TOTP → exécuter via l'hyperviseur
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    # TODO : pousser les états en direct (authentification requise)
    await websocket.accept()
    await websocket.send_json({"status": "connected"})
    await websocket.close()
