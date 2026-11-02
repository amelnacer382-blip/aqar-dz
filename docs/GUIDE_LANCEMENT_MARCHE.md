# Guide Opérationnel — Lancement sur le Marché Algérien (Aqar DZ)

Ce document récapitule les procédures techniques et commerciales pour lancer **Aqar DZ** auprès des agences immobilières en Algérie.

---

## 1. Flux Commercial & Encaissement des Abonnements

En Algérie, les agences immobilières règlent leurs abonnements professionnels par **BaridiMob**, **versement CCP**, **virement bancaire (RIB)** ou **chèque**.

### Coordonnées officielles configurables (`.env`)
```bash
# Modalités de paiement officielles affichées aux agences
PAYMENT_BARIDIMOB_RIP="007 99999 0000000000 00"
PAYMENT_CCP_NUMBER="00000000"
PAYMENT_CCP_KEY="00"
PAYMENT_BANK_NAME="Banque Nationale d'Algérie (BNA)"
PAYMENT_BANK_RIB="001 00000 0000000000 00"
PAYMENT_BENEFICIARY="Aqar DZ"
SUPPORT_PHONE="0652 67 01 51"
SUPPORT_WHATSAPP="213652670151"
```

### Parcours de l'agence cliente
1. L'agence souscrit à l'offre (*Starter 2 900 DA*, *Pro 7 900 DA*, *Enterprise 19 900 DA*).
2. Dans son espace **Paramètres** (`/agency/settings`), elle dispose d'une fiche complète avec les coordonnées BaridiMob / CCP / RIB et un bouton de copie en 1 clic.
3. Elle effectue son paiement et clique sur **« Transmettre mon reçu via WhatsApp »** (message pré-rempli avec le nom de l'agence et l'offre).
4. Le Super-Admin reçoit la capture du reçu et valide l'échéance dans l'espace administration (`/admin/agencies`) en mettant à jour la date `subscriptionEndsAt`.

---

## 2. Sauvegarde & Restauration de la Base de Données

Les scripts automatisés respectent les exigences de sécurité et de continuité d'activité (Stories 0.1 & 0.2).

### Exécuter une sauvegarde
```bash
npm run db:backup
```
- **Format :** Export `pg_dump` compressé en `gzip` (`backups/aqar_backup_YYYY-MM-DD_HH-mm-ss.sql.gz`).
- **Contrôle d'intégrité :** Empreinte numérique SHA-256 générée automatiquement dans un fichier `.json`.
- **Rétention automatique :** Rotation des 7 dernières sauvegardes quotidiennes pour ne pas saturer le disque.

### Restaurer une sauvegarde en cas d'incident
```bash
node scripts/restore.mjs ./backups/aqar_backup_2026-11-02_12-31-56.sql.gz
```
- Décompresse et réinjecte la base proprement (flags `--clean` et `--if-exists`).
- Exécute un contrôle d'intégrité automatique sur les tables clés (`agencies`, `users`, `properties`).
- **RTO (Temps de rétablissement) :** < 30 secondes.
- **RPO (Perte maximale de données) :** 24 heures (intervalle de sauvegarde quotidienne).

---

## 3. Mise en Production Définitive

### A. Stockage des photos et documents
Pour que les photos des biens soient conservées lors des mises à jour applicatives :
1. Créez un projet gratuit sur [Supabase](https://supabase.com).
2. Créez un bucket public nommé `aqar-uploads`.
3. Renseignez dans votre `.env` de production :
```bash
SUPABASE_URL="https://votre-projet.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="votre-cle-service-role"
SUPABASE_STORAGE_BUCKET="aqar-uploads"
```

### B. Envoi d'emails transactionnels (SMTP)
Créez un compte gratuit sur [Brevo](https://www.brevo.com) ou [Resend](https://resend.com) et renseignez :
```bash
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="votre-login"
SMTP_PASSWORD="votre-mot-de-passe-smtp"
FROM_EMAIL="Aqar DZ <contact@aqar.dz>"
```

### C. Déploiement Docker (VPS)
```bash
docker compose -f docker-compose.prod.yml up -d
```
Le reverse-proxy Nginx expose le service sur le port `80` / `443` avec SSL Certbot automatique.
