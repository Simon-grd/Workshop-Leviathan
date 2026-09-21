# Architecture

## Flux principal

1. Le **simulateur** (ou node_exporter en réel) expose `battery_percent` et `power_draw_watts`.
2. **Prometheus** scrape toutes les 5 s (nœuds, cAdvisor, simulateur).
3. **Grafana** affiche RAM/CPU par tier, batterie, temps restant estimé ; une alerte peut appeler le webhook de l'hyperviseur.
4. L'**hyperviseur** interroge `/api/v1/query` de Prometheus, estime le temps restant (EMA) et applique les seuils.
5. Selon le niveau atteint : arrêt des conteneurs `loisir`, puis `recherche`, puis promotion de la réplique BDD sur le cluster Alpine.
6. Le **terminal** permet de redémarrer un tier coupé après validation de deux officiers.

## Principes

- **Fail-safe** : si Prometheus est injoignable, l'hyperviseur ne coupe rien de vital et alerte.
- **Idempotence** : un niveau déjà appliqué n'est pas rejoué.
- **Anti-rebond** : N lectures consécutives sous le seuil avant d'agir.
- **Auditabilité** : chaque action est journalisée (qui/quoi/quand/pourquoi).

## À compléter

- [ ] Schéma réseau (équipe infra)
- [ ] Schéma applicatif final
- [ ] Justification des choix (Alpine, Samba AD, VRRP, réplication vs dump) pour le dossier PDF
