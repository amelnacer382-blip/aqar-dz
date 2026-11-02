# Story 1.5: Échapper les données utilisateur dans les emails

Status: done

## Story

As a agence,
I want que les emails envoyés par Aqar DZ ne puissent pas contenir de HTML injecté par un visiteur,
so that mon serveur ne signe pas un message de hameçonnage.

**Couvre :** BUG-02 (défaut n° 05) · NFR-02
**Spec manuscrite :** `docs/stories/story-02-echapper-les-sorties.md` (matière première, pas à jour)

## Le défaut

`emailLayout` déclare son contrat noir sur blanc :

```ts
/** Paragraphes, deja echappes. */
body: string[]
```

**Aucun appelant ne l'honore.** `notifyAgencyOfLead` interpole directement
dans du HTML le nom, le message et le titre du bien — tous issus du
formulaire public de la vitrine, accessible sans compte :

```ts
`<strong>${leadName}</strong> vous a écrit depuis votre vitrine en ligne.`,
message ? `« ${message} »` : "",
```

Un visiteur envoie pour message :

```html
<a href="https://aqar-dz-secure.example/login">
  Votre abonnement expire : confirmez vos identifiants
</a>
```

L'agence reçoit un email qui vient **réellement** du serveur Aqar DZ, avec
la bonne mise en page, la bonne signature, et qui passe SPF et DKIM sans
broncher. C'est un canal de hameçonnage de bien meilleure qualité que
n'importe quel email forgé, et son coût est de remplir un formulaire de
contact.

## Trois points que le registre ne nomme pas

Relevés en lisant le code, pas en lisant l'audit :

**1. `title` est interpolé brut, lui aussi.** `emailLayout` l'insère
directement dans le `<h1>` (`lib/mailer.ts:170`), et `notifyAgencyActivated`
lui passe `${agencyName}` — alimenté par le formulaire d'inscription. Le
registre ne cite que `body` ; corriger `body` seul laisserait la moitié de
la surface ouverte.

**2. Le sujet part dans un en-tête sans le moindre filtrage.**
`writeToOutbox` écrit `Subject: ${subject}` dans un fichier `.eml`
(`lib/mailer.ts:92`). Un retour chariot dans `leadName` y injecte des
en-têtes. La portée est faible — cette fonction rend la main en production
— mais le sujet vaut d'être assaini une fois pour toutes, à l'endroit où
il entre.

**3. `firstName` et `lastName` n'ont aucune borne.** `leadSchema` impose
`min(2)` et rien d'autre, quand `message` est borné à 2 000. Un nom de
cent mille caractères entre donc dans le sujet et dans le corps. C'est ce
que vise le troisième critère de la spec d'épopée.

## Ce que je tranche, et pourquoi

**`emailLayout` cesse d'accepter du HTML.**

La correction que propose le registre — « une fonction `escapeHtml()`
appliquée à toute valeur d'origine utilisateur avant l'appel » — ferme le
défaut d'aujourd'hui et laisse le piège en place. Le contrat
« déjà échappés » est déjà écrit, en toutes lettres, au-dessus du
paramètre : il n'a protégé personne. Un commentaire ne fait pas respecter
une invariante ; il indique seulement à qui reprocher l'oubli.

Le corps devient donc une structure, et l'échappement descend dans le
gabarit :

```ts
type Fragment = string | { fort: string }
type Paragraphe = string | Fragment[]
```

Un appelant ne peut plus produire de balise, même en le voulant : il n'a
plus d'endroit où en écrire une. Et le compilateur passe en revue les
quatre appelants existants, ce qu'un commentaire ne fait pas.

**Bénéfice de bord : la version texte cesse d'être fausse.** Aujourd'hui
`emailLayout` la fabrique en retirant les balises du HTML
(`p.replace(/<[^>]+>/g, "")`). Avec un simple `escapeHtml` au point
d'appel, une agence nommée « Immo & Fils » recevrait un email texte
disant `Immo &amp; Fils`. En partant des valeurs brutes, les deux versions
sont justes.

**Le sujet est assaini dans `sendMail`**, pas chez chaque appelant : c'est
le seul passage obligé, et un en-tête d'email n'a aucune raison de
contenir un retour à la ligne.

## Acceptance Criteria

1. **Given** un visiteur qui poste `<a href="…">Confirmez vos identifiants</a>` dans le formulaire public
   **When** l'agence reçoit la notification
   **Then** le lien apparaît en **texte littéral** dans le corps HTML comme dans la version texte, jamais comme lien cliquable

2. **Given** le contrat de `emailLayout`
   **When** la story est terminée
   **Then** il n'est plus possible pour un appelant de passer du HTML : le type l'interdit, et les quatre appelants (`notifyAgencyOfLead`, `notifyAgencyActivated`, `notifyPlatformOfSignup`, `sendPasswordResetEmail`) sont convertis

3. **Given** un nom d'agence contenant `&`, `<` ou `>`
   **When** l'email est rendu
   **Then** le HTML l'échappe et la **version texte l'affiche tel quel** — pas d'entités qui fuient dans le texte brut

4. **Given** `title` et `actionUrl`, aujourd'hui interpolés bruts
   **When** ils reçoivent une valeur d'origine utilisateur
   **Then** `title` est échappé, et `actionUrl` n'est rendu que s'il désigne `http:` ou `https:`

5. **Given** le sujet de l'email, qui reprend le nom du visiteur et celui de l'agence
   **When** ce nom est anormalement long ou contient un retour chariot
   **Then** le sujet est borné et débarrassé de ses retours à la ligne avant d'entrer dans l'en-tête

6. **Given** le formulaire public
   **When** un visiteur y saisit un nom
   **Then** `firstName` et `lastName` sont bornés, comme `message` l'est déjà

7. **Given** les emails légitimes (activation, réinitialisation, inscription)
   **When** la story est terminée
   **Then** ils partent toujours, avec la même mise en page et la même version texte — la conversion ne casse aucun envoi

## Tasks / Subtasks

- [x] **Tâche 1 — Descendre l'échappement dans le gabarit** (AC 1, 2, 3, 4)
  - [x] `lib/mailer.ts` : `escapeHtml` interne, `body: Paragraphe[]`, `title` échappé
  - [x] Version texte reconstruite à partir des valeurs brutes, plus par retrait de balises
  - [x] `actionUrl` : refuser tout schéma autre que `http:`/`https:`, échapper l'attribut
  - [x] Supprimer le commentaire « déjà echappes » : il n'a plus d'objet

- [x] **Tâche 2 — Convertir les quatre appelants** (AC 2, 7)
  - [x] `notifyAgencyOfLead`, `notifyAgencyActivated`, `notifyPlatformOfSignup`, `sendPasswordResetEmail`

- [x] **Tâche 3 — Assainir le sujet** (AC 5)
  - [x] Dans `sendMail` : retirer CR/LF, réduire les blancs, borner la longueur

- [x] **Tâche 4 — Borner les noms** (AC 6)
  - [x] `leadSchema.firstName` / `lastName` : un `max` cohérent avec le reste du fichier

- [x] **Tâche 5 — Prouver** (AC 1, 3, 5, 7)
  - [x] Test : un message contenant `<a href>` ressort inerte — sur le gabarit réel, PAS via la boîte locale `.mail/` ni via un post sur la vitrine. Le chemin complet formulaire → email n'est couvert par aucun test : reporté
  - [x] Test : `&` ressort tel quel dans la version texte
  - [x] Vérifier qu'aucun email légitime ne régresse — comparaison manuelle avant/après sur les quatre emails, aucun test automatisé : reporté
  - [x] **Mutation** : retirer l'échappement → le test d'AC 1 doit rougir. Une mutation qui casse la compilation ne prouve rien

- [x] **Tâche 6 — Consigner**
  - [x] `docs/qa/bug-report.md` (BUG-02), `deferred-work.md`, `sprint-status.yaml`

## Dev Notes

**La boîte locale `.mail/` est le point d'observation.** SMTP n'est pas
configuré dans l'environnement de test — `writeToOutbox` écrit donc
chaque email dans `.mail/*.eml`, en clair. Un test peut poster sur la
vitrine puis lire le fichier produit : c'est l'email réel, pas une
simulation. Attention, la fonction **rend la main en production**
(`NODE_ENV === "production"`), et `npm run test:e2e` lance `next build`
puis `next start`. Vérifier ce que vaut `NODE_ENV` dans le serveur de
test avant de bâtir un test dessus ; si les fichiers ne sont pas écrits,
se rabattre sur un test unitaire du gabarit exécuté avec `ts-node`, comme
pour les adresses Supabase en 1.7.

**Ne pas toucher à la mise en page.** Les styles en ligne sont là parce
que beaucoup de clients de messagerie algériens rendent mal les feuilles
externes (commentaire de `lib/mailer.ts:139`). La story change ce qui
entre, pas ce qui sort.

**`sendPasswordResetEmail` porte le seul lien critique du produit.** Sa
conversion doit être vérifiée en premier : un lien cassé, c'est un
utilisateur qui ne récupère plus son compte.

### Rappels de projet

- Sortie attendue : `npx tsc --noEmit` 0 erreur, `npm run lint` sans avertissement nouveau, `npm run test:e2e` vert
- Ne jamais restaurer une mutation par `git checkout -- <fichier>` (leçon de la 1.3)
- Une mutation qui ne compile pas ne prouve rien (leçon de la 1.3)

## Dev Agent Record

### Debug Log

**La boîte locale était bien inutilisable, comme la story l'anticipait.**
`npm run test:e2e` lance `next build` puis `next start` : `NODE_ENV` vaut
« production », et `writeToOutbox` rend la main dans ce cas —
délibérément, pour ne jamais écrire un lien de réinitialisation dans un
fichier sur un serveur en ligne. Les tests portent donc sur `emailLayout`,
importé par chemin relatif depuis la suite. C'est un test unitaire logé
dans la suite de bout en bout, et le commentaire le dit.

**Preuve sur le chemin réel, hors harnais.** `notifyAgencyOfLead` appelée
avec une charge hostile, en `NODE_ENV` de développement, donc écriture
réelle dans `.mail/` :

```
leadName      = "Karim\r\nBcc: victime@ailleurs.dz"
message       = <a href="https://aqar-dz-secure.example/login">…</a>
propertyTitle = "F3 <script>alert(1)</script> Hydra"
```

Ce que le fichier contient :

```
Subject: Immo & Fils — nouveau message de Karim Bcc: victime@ailleurs.dz
```

— le retour chariot est aplati, aucun en-tête n'est injecté.

```html
<p …>« &lt;a href=&quot;https://aqar-dz-secure.example/login&quot;&gt;Votre
abonnement expire : confirmez vos identifiants&lt;/a&gt; »</p>
<p …>Bien concerné : <strong>F3 &lt;script&gt;alert(1)&lt;/script&gt; Hydra</strong></p>
```

Et la version texte, sans une entité :

```
« <a href="https://aqar-dz-secure.example/login">Votre abonnement expire : … </a> »
```

**AC 7 vérifié sur l'email qui compte.** `sendPasswordResetEmail` avec une
adresse portant deux paramètres :

```
bouton : <a href="https://aqar.dz/auth/reset?token=abc123&amp;x=1"
texte  : Choisir un nouveau mot de passe : https://aqar.dz/auth/reset?token=abc123&x=1
```

`&` échappé dans l'attribut — ce que tout client décode —, brut dans le
texte. Le lien est intact des deux côtés.

**Mutation — tuée.** En cessant d'échapper les chevrons (mutation qui
compile et passe le lint), le test compte deux `<a>` dans l'email au lieu
d'un : `un second lien a ete injecte dans l'email`. Le bouton d'action
sert de témoin — c'est ce qui rend l'assertion « exactement un lien »
discriminante plutôt que « aucun lien ».

### Completion Notes

Le contrat de `emailLayout` n'est plus un commentaire, c'est un type. Un
appelant ne peut plus produire de balise : il n'a plus d'endroit où en
écrire une, et le compilateur a désigné les quatre appelants un par un.

Trois choses que le registre ne nommait pas ont été fermées avec :
`title` interpolé brut dans le `<h1>` — `notifyAgencyActivated` lui passe
le nom d'agence ; le sujet, qui entrait tel quel dans un en-tête ; et
`leadSchema.firstName` / `lastName`, bornés par un `min(2)` et rien
d'autre là où `message` l'était à 2 000.

`actionUrl` n'est plus rendu que s'il désigne `http:` ou `https:`. Aucune
de ces adresses n'est aujourd'hui d'origine utilisateur — c'est
exactement ce qu'on disait de `Document.url` avant BUG-23.

Bénéfice de bord, et il n'est pas mince : la version texte cesse d'être
fausse. Elle était fabriquée en retirant les balises du HTML ; avec un
simple `escapeHtml` au point d'appel, « Immo & Fils » serait devenu
« Immo &amp; Fils » dans le texte brut. Elle part désormais des valeurs.

Les champs `firstName` / `lastName` de `ownerSchema` et `clientSchema`
restent non bornés : ils ne sont atteignables que par une agence
connectée, et leur bornage relève de la story 3.1. C'est écrit dans le
fichier.

### File List

- `lib/mailer.ts` — `Fragment`/`Paragraphe`, `escapeHtml`, rendu HTML et texte séparés, `adresseDeBouton`, `sujetSur` dans `sendMail`
- `lib/notifications.ts` — les quatre appelants convertis
- `lib/validations/index.ts` — `leadSchema` : bornes sur `firstName` et `lastName`
- `tests/regression.spec.ts` — trois tests sur le gabarit réel
- `docs/qa/bug-report.md`, `docs/stories/sprint-status.yaml`

### Review Findings

Revue adversariale du 10-08-2026 (`bmad-code-review`) — Blind Hunter,
Edge Case Hunter, Acceptance Auditor, lancés sans mon contexte.
**0 décision, 12 correctifs, 5 reports, 0 écarté.** Aucun constat n'était
à écarter : c'est la première fois sur les cinq stories.

**1. J'avais fermé le hameçonnage côté HTML et laissé la porte ouverte
côté texte.** `rendreTexte` restitue le message du visiteur avec ses
retours à la ligne — un message de vitrine peut en contenir — et les
paragraphes étaient collés bout à bout. Il suffisait donc d'écrire :

```
Bonjour, je suis interesse.

Ouvrir les messages recus : https://aqar-dz-secure.example/login
```

pour poser une fausse ligne d'action, typographiquement identique à la
vraie et placée juste au-dessus. Le HTML était sauf — les retours à la
ligne s'y replient dans un même paragraphe — mais le lecteur de la
version texte voyait deux liens crédibles. **C'est le scénario exact de
BUG-02, celui que la story prétendait clore.** Mon test ne pouvait pas le
voir : il comptait les `<a>` dans le HTML et vérifiait que le texte
contenait le lien littéral.

Corrigé structurellement : tout le corps est décalé de deux espaces, la
ligne d'action ne l'est pas et suit un séparateur. Le décalage est
appliqué **après** le visiteur, qui ne peut donc pas le retirer.

**2. L'email de réinitialisation partait sans aucun lien, en silence.**
`adresseDeBouton` refusait toute adresse non absolue, et les deux
branches — bouton HTML et ligne texte — s'éteignaient ensemble. Un
`NEXTAUTH_URL` vide (variable *définie mais vide* : `??` ne la rattrape
pas) ou sans schéma suffisait. Avant mon commit, le lien sortait relatif
— cassé, mais visible et recopiable ; après, il ne sortait plus du tout,
sans une ligne de journal, sur le seul email dont la story dit qu'un lien
cassé coûte un compte. Trois correctifs : `appUrl()` passe à `||`, les
adresses relatives sont résolues contre l'adresse publique, et
`lib/env.ts` refuse au démarrage un `NEXTAUTH_URL` qui n'est pas absolu
en http(s) — bloquant en production.

**3. Ma mutation sur `title` survivait à la suite complète.** Le
relecteur a refait l'expérience : `${escapeHtml(title)}` → `${title}`, et
les onze assertions des trois tests passaient. La raison est bête —
l'assertion « le HTML contient `Immo &amp; Fils` » était satisfaite par
le `<strong>` du corps, que le titre soit échappé ou non. Le code livré
était juste ; **la preuve ne l'était pas**, et `title` est précisément la
surface que je me félicitais d'avoir trouvée seul. Un test dédié la
couvre maintenant, et la mutation le rougit.

**4. Le texte brut s'échappait de son commentaire HTML.** `writeToOutbox`
emballait la version texte entre `<!--` et `-->` dans un fichier déclaré
`text/html`. Un `-->` dans le message d'un visiteur fermait le
commentaire et rendait la suite vivante : le `.eml` contenait alors un
lien cliquable — dans le seul artefact que cette fonction existe pour
produire, et que la story désigne comme « l'email réel ». Portée
développement uniquement. Remplacé par un vrai `multipart/alternative`, à
frontière aléatoire.

**5. `agencyName` restait non borné, alors que c'est mon propre
raisonnement.** J'avais borné `leadSchema.firstName` en écrivant que
« ces valeurs entrent dans le sujet et dans le corps ». `agencyName`
entre dans le **même** sujet, dans le `<h1>` de l'email d'activation et
dans le corps de celui envoyé aux super admins — et il est resté
`min(2)`. Borné à 120. `emailLayout` borne en outre le titre et chaque
paragraphe : `escapeHtml` peut quintupler une valeur, et un nom d'un
mégaoctet coûtait 155 ms de boucle d'événements bloquée pour 4,5 Mo de
HTML.

**Les autres correctifs.** `sujetSur` coupait au milieu des paires de
substituts UTF-16 (emoji rendu `�`) et appliquait ses expressions
régulières **avant** de tronquer — 618 ms sur une chaîne de dix
mégaoctets ; il coupe désormais d'abord, sur des frontières de points de
code, avec la borne exprimée en unités. La version texte utilisait
l'adresse brute là où le HTML utilisait la normalisée. `actionUrl` sans
`actionLabel` produisait `undefined : https://…` — même condition des
deux côtés maintenant. `To:` et `From:` n'étaient pas assainis alors que
`Subject:` l'était. Le nom de fichier de la boîte locale s'écrasait à la
milliseconde. Et deux de mes assertions étaient mortes : `not.toContain`
sur une chaîne qui n'apparaît jamais, et un compte de `<a` insensible à
`<img>` ou `<script>`.

**Reportés** dans `deferred-work.md` : le chemin complet formulaire de
vitrine → email n'est couvert par aucun test — mes tests reconstruisent
le corps à la main, et survivraient à la disparition de l'appel à
`notifyAgencyOfLead` ; aucun test ne rend un email légitime ; le sujet
n'est pas encodé RFC 2047 dans le `.eml` ; `sendMail({ html })` reste une
porte ouverte pour un futur appelant qui fabriquerait son HTML sans
passer par le gabarit ; les bornes de `ownerSchema` / `clientSchema`
(story 3.1).

**Une affirmation à corriger, et elle est de moi.** J'ai écrit que
`NODE_ENV` vaut « production » dans le harnais, donc que `.mail/` n'y est
jamais écrit. C'est vrai en intégration continue. Hors CI,
`reuseExistingServer` peut réutiliser un `npm run dev` déjà lancé — sur
le même port 3002 — où `NODE_ENV` vaut « development » et où la boîte
locale *est* écrite. La justification tient, mais elle n'est pas
inconditionnelle ; le commentaire du fichier de test le dit désormais.

## Change Log

| Date | Version | Description |
|---|---|---|
| 10-08-2026 | 0.1 | Story créée depuis `docs/epics.md` §1.5 et BUG-02 |
| 10-08-2026 | 1.0 | Implémentée. Statut → review |
| 11-08-2026 | 1.1 | Revue adversariale : 12 correctifs. Suite complète à 90 tests, 3 mutations tuées. Statut → done |
