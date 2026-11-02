# Story 04 — Robustesse des saisies et tenue à la charge

**Statut :** À faire
**Lot :** 2 — avant la montée en charge
**Couvre :** BUG-05, BUG-06, BUG-07, BUG-08, BUG-09, BUG-11
**Gravité :** 🟡 Moyenne

---

## Story

**En tant qu**'agence,
**je veux** qu'une saisie maladroite produise un message clair plutôt qu'un
écran d'erreur, et que les écrans restent rapides quand mon portefeuille
grandit,
**afin de** ne pas perdre une fiche à cause d'un chiffre mal placé ni voir
le logiciel ralentir à mesure que je réussis.

---

## Contexte

Six défauts indépendants, réunis parce qu'ils relèvent du même travail :
faire tenir les bornes que la base impose déjà, et arrêter de charger ce
qu'on ne lit pas.

---

## Critères d'acceptation

### Bornes de saisie

1. La commission d'un bien est refusée au-delà de 100, avec un message
   français explicite indiquant qu'il s'agit d'un pourcentage.
   *(Aujourd'hui : `1000` provoque `numeric field overflow`, `150` est
   accepté et fait calculer 150 % du loyer.)*
2. Les entiers de description d'un bien (`rooms`, `bedrooms`, `bathrooms`,
   `floor`, `totalFloors`) sont bornés à une valeur plausible.
3. Aucune saisie de formulaire ne peut plus produire un écran d'erreur
   technique : toute violation de contrainte est convertie en message.

### Validation des énumérations

4. Le changement de statut d'une agence passe par `agencyStatusSchema`
   (qui existe déjà et n'est utilisé nulle part) au lieu du cast
   `as "pending" | "active" | "suspended"`.
5. Une valeur de statut inconnue produit un message, pas une erreur Prisma.

### Charge

6. `/admin/agencies` n'hydrate plus les utilisateurs et les biens de chaque
   agence pour n'en afficher que le nombre : `_count` uniquement.
   *(Aujourd'hui : 50 agences × 2 000 biens = 100 000 objets chargés.)*
7. La vitrine publique est paginée, au même contrat que les onze listes de
   l'espace agence (`readPageParams`, 100 lignes maximum).
8. La pagination de la vitrine préserve les filtres actifs (opération,
   type, wilaya, prix) dans les liens de page.

### Dépôt de fichier

9. `/api/upload` applique une limitation de débit par agence.
10. Le type réel du fichier est vérifié sur ses premiers octets, et non sur
    le `Content-Type` déclaré par l'appelant.
11. Un fichier refusé pour cause de taille l'est **avant** l'envoi, côté
    navigateur (la propriété `maxSize` de `UploadDropzone` est aujourd'hui
    purement décorative — BUG-13, rattaché ici).

---

## Tâches

- [ ] `lib/validations/index.ts` — créer un `percentage` (0 à 100, deux
      décimales) et l'appliquer à `propertySchema.commission`. Attention :
      `commission` apparaît aussi dans `saleSchema` et
      `rentalManagementSchema`, où il s'agit d'un **montant en dinars**,
      colonne `Decimal(15,2)` — ne pas y toucher.
- [ ] `lib/validations/index.ts` — borner `optionalInt` (ou créer une
      variante bornée pour les champs de description d'un bien).
- [ ] `app/admin/agencies/page.tsx:100` — remplacer le cast par
      `parseForm(agencyStatusSchema, formData)`.
- [ ] `app/admin/agencies/page.tsx:75-79` — remplacer
      `include: { users: true, properties: true }` par
      `include: { _count: { select: { users: true, properties: true } } }`,
      puis les usages lignes 288-289.
      Modèle à suivre : `app/admin/statistics/page.tsx:51`.
- [ ] `app/vitrine/[slug]/page.tsx` — appliquer `readPageParams` et
      `<Pagination />`, en conservant les paramètres de filtre.
- [ ] `app/api/upload/route.ts` — `rateLimit({ key: 'upload:' + agencyId })`
      et vérification de la signature du fichier.
- [ ] `components/upload/UploadDropzone.tsx` — appliquer réellement
      `maxSize` avant l'appel réseau.

---

## Notes de développement

**Le piège de la commission.** Le mot désigne deux choses différentes dans
le modèle : un **taux** sur `Property` (`Decimal(5,2)`, libellé
« Commission (%) » dans le formulaire) et un **montant** sur `Sale` et
`RentalManagement` (`Decimal(15,2)`). Le calcul de `generateMonth` est
correct — `Math.round(rent * rate / 100)` — c'est la borne d'entrée qui
manque. Ne pas « harmoniser » les trois champs : ils sont légitimement
différents.

**Pagination de la vitrine.** C'est la seule page publique du logiciel et
le module désigné prioritaire. Vérifier que le composant `<Pagination />`
existant sait produire des liens sans session ; il est aujourd'hui utilisé
uniquement dans l'espace agence.

**Vérification du type de fichier.** Comparer les premiers octets aux
signatures connues (`FF D8 FF` pour JPEG, `89 50 4E 47` pour PNG,
`52 49 46 46` + `WEBP` pour WebP, `25 50 44 46` pour PDF). Pas besoin de
dépendance pour quatre formats.

---

## Tests

- Saisir `1000` puis `150` dans la commission d'un bien : message dans les
  deux cas, aucun écran d'erreur.
- Poster un statut d'agence inconnu : message, pas de trace Prisma.
- Charger `/admin/agencies` avec la base de démonstration et comparer le
  nombre de requêtes avant/après.
- Publier plus de 100 biens sur l'agence de démonstration et charger la
  vitrine.
- Déposer un fichier texte renommé en `.png` : refus.
