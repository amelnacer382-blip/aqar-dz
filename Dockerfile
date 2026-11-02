# ==========================================
# Aqar DZ - Dockerfile multi-stage
# ==========================================

# --- Base image ---
FROM node:20-alpine AS base
# openssl n'est pas fourni par l'image Alpine, et Prisma en depend :
# sans lui, le moteur de schema echoue au demarrage sur un message
# trompeur — « Could not parse schema engine response » — qui ne dit
# nulle part qu'il s'agit d'une bibliotheque manquante.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# --- Dépendances ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# --- Build (production) ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# Demande la sortie autonome, que l'etape suivante copie depuis
# .next/standalone. Elle n'est pas activee par defaut : elle rendrait
# `next start` bruyant en local pour un besoin propre a l'image.
ENV NEXT_OUTPUT=standalone

# Valeurs factices, valables uniquement pendant la construction.
#
# `next build` execute instrumentation.ts, qui refuse de demarrer en
# production sans secret de session valide : sans ces lignes, la
# construction de l'image echouerait avant meme d'avoir compile une page.
# Et `prisma generate` reclame DATABASE_URL pour resoudre le datasource.
#
# Elles ne fuient pas dans l'image finale : l'etape de production repart
# de `base` et ne recopie que les fichiers produits. Les vraies valeurs
# sont injectees a l'execution par docker-compose.
ENV NEXTAUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npx prisma generate
RUN npm run build

# --- Production ---
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Le client Prisma, recopie explicitement.
#
# La sortie autonome de Next embarque les modules qu'elle sait tracer,
# mais le moteur de requete de Prisma est un binaire charge dynamiquement :
# l'analyse statique ne le voit pas toujours. L'oubli ne se remarque qu'au
# demarrage du conteneur, sur une erreur « Query engine not found ».
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# sharp, recopie explicitement — story 3.7.
#
# NEXT LE CHARGE PAR UN `require` DYNAMIQUE :
#
#   sharp = require(process.env.NEXT_SHARP_PATH || "sharp")
#   (next/dist/server/image-optimizer.js:157)
#
# L'analyse statique qui construit `.next/standalone` ne voit pas toujours
# ce chemin. Et l'oubli ne se remarque PAS a la construction : il se
# remarque a la premiere image demandee, par une 500. Lu dans le meme
# fichier, ligne 665 :
#
#   if (showSharpMissingWarning && nextConfigOutput === "standalone") {
#     throw new ImageError(500, "Internal Server Error")
#   }
#
# Hors conteneur, Next retombe sur Squoosh et l'absence ne fait qu'un
# avertissement. EN SORTIE AUTONOME — c'est-a-dire exactement ici — c'est
# une erreur. Le meme raisonnement que pour le client Prisma juste
# au-dessus, et la meme parade.
#
# `@img/` porte les binaires de libvips ; sans eux, `sharp` ne charge pas.
# `npm ci` les resout pour linux-musl dans l'etage `deps`, puisque cette
# image est une Alpine.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

# Les migrations, recopiees pour que l'image SACHE ce qu'elle connait.
#
# BUG-37 : la base a ete migree pendant que cette image restait en arriere,
# et rien ne pouvait le dire — la sortie autonome de Next ne trace pas
# `prisma/`, donc le conteneur n'avait aucun moyen de comparer. La sonde de
# sante lit ce dossier (lib/migrations.ts) et refuse de se declarer saine
# si la base porte une migration qu'il ignore.
#
# Retirer cette ligne ne casse pas le build : elle casse la sonde, qui
# repondra 503 « incomparable ». C'est voulu — une comparaison qu'on ne peut
# pas faire ne doit pas se lire comme une comparaison reussie.
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations ./prisma/migrations

# Points de montage des fichiers televerses.
#
# Crees ici et donnes a nextjs : un volume Docker monte sur un chemin
# inexistant est cree par le demon avec les droits de root, et le
# processus — qui ne tourne pas en root — ne pourrait plus y ecrire une
# seule photo.
RUN mkdir -p ./public/uploads/properties ./public/uploads/agencies ./public/uploads/documents \
    && chown -R nextjs:nodejs ./public/uploads

# Le commit dont cette image est issue, grave dans un FICHIER.
#
# REP-96, story 2.8. Le 15-08-2026, l'image en service datait du 09-08 et
# accusait 67 commits de retard sans que rien ne puisse le dire ; la
# verification a conclu a une regression de securite qui n'existait pas.
#
# UN FICHIER, ET NON UNE `ENV`. Mesure du 17-08-2026 sur une image jetable
# portant les deux :
#
#   docker run --rm -e COMMIT_SHA=valeur-venue-du-.env image
#   -> ENV=[valeur-venue-du-.env]   FICHIER=[abc1234]
#
# `docker-compose.prod.yml` charge `.env` dans ce conteneur (`env_file`),
# et un `env_file` pose exactement ce que `-e` pose : une `ENV` gravee ici
# serait ECRASEE, et la sonde annoncerait un commit qui n'est pas le sien.
# L'environnement ne peut rien contre un fichier.
#
# PAS DE LECTURE DE `.git` : `.dockerignore` l'exclut du contexte, et c'est
# voulu — un `.env` present sur la machine se retrouverait sinon dans une
# couche. Le SHA entre donc par l'ARG, pose par docker-compose.prod.yml.
#
# PLACE ICI, LE PLUS TARD POSSIBLE, ET CE N'EST PAS DU STYLE. Un `ARG`
# invalide le cache de construction A PARTIR DE SA DECLARATION, et
# COMMIT_SHA change a CHAQUE deploiement : declare en tete de cet etage, il
# ferait rejouer toutes les COPY ci-dessus a chaque fois.
#
# AU-DESSUS DE `USER nextjs` : le fichier est ecrit par root en 644, donc
# lisible par nextjs, qui n'a aucune raison d'y ecrire.
#
# Sans l'ARG, la construction ne rate pas — elle grave du vide, et
# lib/version.ts rend « inconnu ». C'est volontaire : une image qui ne sait
# pas d'ou elle vient sert quand meme.
ARG COMMIT_SHA=""
RUN printf '%s' "$COMMIT_SHA" > ./.commit

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

# --- Développement ---
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
ENV PORT=3000
# Le port est impose ici, et non laisse au script npm : `npm run dev` fixe
# 3002 par un drapeau, qui l'emporte sur la variable PORT. Le conteneur
# ecoutait donc sur 3002 pendant que docker-compose publiait 3000 et que
# nginx proxifiait vers 3000 — rien ne repondait.
CMD ["npx", "next", "dev", "-p", "3000"]
