#!/usr/bin/env bash
#
# Story 2.6, T3 — la sonde repond-elle 200 sur une base MIGREE ET VIDE ?
#
# POURQUOI CE SCRIPT EXISTE.
# L'AC-1 porte deux clauses, et la seconde est la condition de la story :
# une sonde qui lit une ligne reelle pour detecter la derive echouerait sur
# une base sans aucune ligne — le premier deploiement, avant tout `seed`.
# Elle declarerait `unhealthy` une installation neuve et parfaitement saine.
# Le refus doit venir de l'exception de deserialisation, jamais d'un
# decompte a zero.
#
# Cela ne se deduit pas. Le 16-08-2026, le raisonnement « findFirst suffit »
# a ete DEMENTI par la mutation : la ligne rendue est arbitraire, elle
# portait `starter`, et la sonde restait verte sur un client incapable de
# lire `pro`. C'est ce dementi qui a impose `groupBy`. La meme prudence
# s'applique ici : on mesure.
#
# CE QU'IL NE FAIT PAS, ET C'EST VOULU.
# Aucune commande `docker volume` n'apparait dans ce fichier, et aucun
# `docker compose down`. La base jetable vit dans la couche inscriptible
# d'un conteneur — il n'y a pas de volume a supprimer, donc pas de volume a
# confondre avec `aqar-prod_postgres_data`. Le demontage ne nomme que des
# conteneurs et un reseau.
#
# CE QU'IL DEMANDE A L'EDITEUR.
# `npx prisma migrate deploy` est dans le `deny` de `.claude/settings.json`.
# C'est la seule facon FIDELE d'obtenir l'etat cherche : elle seule ecrit
# `_prisma_migrations`, la table meme que la sonde interroge. Appliquer les
# `.sql` a la main donnerait un schema sans son journal — une base que la
# sonde declarerait « en retard », et un test qui fabriquerait son propre
# oracle. D'ou ce script, lance par l'editeur.
#
# Usage :  bash scripts/eprouver-base-vierge.sh

set -uo pipefail

PG=aqar-t3-pg
APP=aqar-t3-app
RESEAU=aqar-t3-net
PORT_PG=5435          # 5433 est pris par aqar-postgres-prod, publie sur la boucle locale
PORT_APP=3004         # 3002 = npm run dev, 3003 = side-car de T1
# On eprouve PAR DEFAUT l'image REELLEMENT EN SERVICE — celle que
# `docker compose up --build` construit et que le conteneur de production
# sert. Le 17-08-2026 la mesure a ete faite sur `aqar-dz:candidat`, batie
# cinq minutes apres le dernier commit du code de la sonde (a224d4c a 17h22,
# image a 17h27) : meme code, verifie plutot que suppose. Mais une image
# annexe vieillit sans le dire, et cette story est nee exactement de la —
# une image en retard qui se declarait saine. Celle qui sert est la seule
# qui ne puisse pas mentir sur ce qui est deploye.
IMAGE=${IMAGE_A_EPROUVER:-aqar-dz:latest}

# Rien n'est en dur : les deux secrets vivent le temps du script.
MDP=$(openssl rand -hex 12)
SECRET=$(openssl rand -base64 32)

DEPOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$DEPOT" || exit 1

echec() { echo; echo "ECHEC — $1"; exit 1; }

# Le demontage ne nomme que des conteneurs et un reseau. Jamais un volume.
nettoyer() { docker rm -f "$PG" "$APP" >/dev/null 2>&1; docker network rm "$RESEAU" >/dev/null 2>&1; }
trap nettoyer EXIT
nettoyer

echo "=== 1. une base jetable, sans volume ==="
docker network create "$RESEAU" >/dev/null || echec "reseau non cree"
docker run -d --rm --name "$PG" --network "$RESEAU" \
  -p "127.0.0.1:$PORT_PG:5432" \
  -e POSTGRES_USER=t3 -e POSTGRES_PASSWORD="$MDP" -e POSTGRES_DB=t3 \
  postgres:16-alpine >/dev/null || echec "postgres jetable non demarre"

printf "    attente"
for _ in $(seq 1 40); do
  docker exec "$PG" pg_isready -U t3 -d t3 >/dev/null 2>&1 && break
  sleep 1; printf "."
done
echo
avant=$(docker exec "$PG" psql -U t3 -d t3 -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
echo "    tables avant migration : $avant"
[ "$avant" = "0" ] || echec "la base jetable n'est pas vierge — on n'a pas la bonne cible"

echo
echo "=== 2. migrations appliquees SUR LA BASE JETABLE ==="
DATABASE_URL="postgresql://t3:$MDP@127.0.0.1:$PORT_PG/t3" \
  npx prisma migrate deploy 2>&1 | sed 's/^/    /'

# POST-CONDITION, et elle n'est pas decorative : si `.env` avait pris le pas
# sur la variable ci-dessus, Prisma aurait migre la base de PRODUCTION — un
# non-evenement, elle est deja a jour — et la base jetable serait restee
# vide. On le verifie au lieu de l'esperer.
embarquees=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l)
appliquees=$(docker exec "$PG" psql -U t3 -d t3 -tAc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL" 2>/dev/null)
echo "    embarquees dans le depot : $embarquees   appliquees ICI : ${appliquees:-0}"
[ "${appliquees:-0}" = "$embarquees" ] || echec "les migrations ne sont pas arrivees sur la base jetable"

echo
echo "=== 3. la base est-elle VIDE de donnees ? ==="

# La premiere version de ce bloc interrogeait "Agency", "User", "Property" :
# les noms des MODELES Prisma. Les 19 modeles sont tous `@@map`es en
# snake_case pluriel (`agencies`, `users`, `properties`), donc la requete
# levait `relation "Agency" does not exist` — et le script annonçait « Agency
# n'est pas vide », un diagnostic faux sur une base parfaitement vide.
# Corrige le 17-08-2026, dans les deux sens :
#   - on ne recopie plus AUCUN nom de table : on les demande au catalogue,
#     ce qui survit a tout `@@map` futur et couvre les 19, pas trois ;
#   - une requete EN ECHEC ne se lit plus comme un compte non nul. §6 : un
#     controle incapable de distinguer « absent » de « non vide » donne un
#     rouge qui designe la mauvaise cause.
tables=$(docker exec "$PG" psql -U t3 -d t3 -tAc \
  "SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE'")
echo "    tables applicatives trouvees : $tables"
[ "${tables:-0}" -ge 19 ] || echec "le schema n'est pas en place (19 modeles attendus au minimum)"

# Comptage EXACT, table par table, sans en nommer aucune. `query_to_xml`
# execute un `count(*)` par table du catalogue ; `n_live_tup` de
# `pg_stat_user_tables` aurait ete une ESTIMATION, et une estimation ne
# prouve pas une base vide.
lignes=$(docker exec "$PG" psql -U t3 -d t3 -tAc "
  SELECT coalesce(sum(n), 0) FROM (
    SELECT (xpath('/row/c/text()',
             query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                          false, true, '')))[1]::text::bigint AS n
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name <> '_prisma_migrations'
  ) s")
[ -n "$lignes" ] || echec "le comptage n'a pas abouti — on ne conclut pas d'une requete en echec"
echo "    lignes, toutes tables confondues (hors _prisma_migrations) : $lignes"
[ "$lignes" = "0" ] || {
  docker exec "$PG" psql -U t3 -d t3 -tAc "
    SELECT table_name || ' : ' || (xpath('/row/c/text()',
             query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                          false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name <> '_prisma_migrations'" | grep -v ' : 0$' | sed 's/^/      /'
  echec "la base porte des donnees — ce n'est plus le cas etudie"
}

echo
echo "=== 4. la sonde, servie par l'image candidate, contre cette base vide ==="
docker image inspect "$IMAGE" >/dev/null 2>&1 || \
  docker build --target production -t "$IMAGE" -f docker/Dockerfile . 2>&1 | tail -3
# Dire QUELLE image a rendu le verdict : sans cette ligne, un vert obtenu sur
# une image perimee serait indiscernable d'un vert obtenu sur celle qui sert.
echo "    image eprouvee : $IMAGE, construite le $(docker image inspect "$IMAGE" --format '{{.Created}}')"

# Aucune variable de production n'est injectee : pas de `--env-file .env`.
# Si l'override de DATABASE_URL echouait, le side-car interrogerait la base
# REELLE et rendrait un 200 qui ne prouverait rien. On ne lui donne donc
# jamais l'occasion de connaitre l'autre adresse.
docker run -d --name "$APP" --network "$RESEAU" \
  -p "127.0.0.1:$PORT_APP:3000" \
  -e DATABASE_URL="postgresql://t3:$MDP@$PG:5432/t3" \
  -e NEXTAUTH_SECRET="$SECRET" \
  -e NEXTAUTH_URL="http://localhost:$PORT_APP" \
  -e AUTH_TRUST_HOST=true -e NODE_ENV=production \
  "$IMAGE" >/dev/null || echec "side-car non demarre"

printf "    demarrage"
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT_APP/api/public/health" && break
  sleep 1; printf "."
done
echo

corps=$(curl -s -o /dev/stdout -w "" "http://localhost:$PORT_APP/api/public/health")
code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT_APP/api/public/health")
echo "    HTTP $code   $corps"

echo
echo "=== VERDICT ==="
[ "$code" = "200" ] || {
  echo "    Journal du side-car :"; docker logs "$APP" 2>&1 | tail -15 | sed 's/^/      /'
  echec "la sonde refuse une base vide et saine — l'AC-1, seconde clause, n'est pas tenu"
}
case "$corps" in
  *'"schema":"a-jour"'*)
    # Le champ `schema` n'existe QUE si les trois etapes gardees ont ete
    # jouees : socket, lecture typee, comparaison des migrations. Sa presence
    # prouve qu'aucune n'a court-circuite les autres.
    echo "    200 et schema=a-jour — les trois etapes gardees ont ete jouees sur une base sans aucune ligne."
    echo "    AC-1 seconde clause : TENU." ;;
  *)
    echec "200 rendu, mais sans schema=a-jour : la comparaison n'a pas eu lieu, le vert ne prouve rien" ;;
esac
