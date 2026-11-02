# Story 02 — Échapper les données utilisateur en sortie

**Statut :** À faire
**Lot :** 1 — avant ouverture au public
**Couvre :** BUG-02 (emails HTML), BUG-03 (exports CSV)
**Gravité :** 🟠 Haute

---

## Story

**En tant qu**'agence,
**je veux** que le contenu écrit par un visiteur anonyme ne soit jamais
interprété comme du code par mes outils,
**afin de** ne pas recevoir de faux emails signés par Aqar DZ ni exécuter
une commande en ouvrant mon export dans Excel.

---

## Contexte

Deux défauts, un seul principe : **une donnée saisie par un tiers traverse
la frontière vers un format actif sans être neutralisée.** Le formulaire
public de la vitrine alimente les deux chemins, ce qui les rend
exploitables sans aucun compte.

Le premier chemin est l'email : `emailLayout` documente explicitement
`body: string[] /** Paragraphes, deja echappes. */`, et aucun appelant ne
respecte ce contrat. Le second est le CSV : `escape()` gère le séparateur
et les guillemets, mais pas le `=` initial qui fait d'une cellule une
formule.

---

## Critères d'acceptation

### Emails

1. Un message de vitrine contenant `<a href="...">` arrive chez l'agence
   affiché **en tant que texte**, balises visibles, lien non cliquable.
2. Un nom d'agence contenant du HTML, à l'inscription, ne produit aucune
   balise active dans l'email envoyé au super admin.
3. La version texte des emails reste lisible (pas d'entités `&lt;` visibles
   là où l'utilisateur attend `<`).

### Exports CSV

4. Une valeur commençant par `=`, `+`, `-`, `@`, tabulation ou retour
   chariot est neutralisée dans le fichier produit.
5. Les huit entités exportables sont couvertes — la correction est dans
   `escape()`, pas dans chaque cas du `switch`.
6. Les valeurs légitimes commençant par `-` (un montant négatif, une note)
   restent lisibles pour un humain.
7. L'ouverture dans Excel en configuration française reste correcte :
   séparateur `;`, BOM UTF-8, accents intacts.

---

## Tâches

- [ ] `lib/mailer.ts` — exporter `escapeHtml(value: string): string`
      (`& < > " '`). L'y placer plutôt que dans `notifications.ts` : c'est
      le module qui pose le contrat.
- [ ] `lib/notifications.ts` — envelopper toute valeur d'origine
      utilisateur : `leadName`, `message`, `propertyTitle`, `leadPhone`,
      `leadEmail` dans `notifyAgencyOfLead` ; `agencyName`, `agencyEmail`,
      `wilaya` dans `notifyPlatformOfSignup`.
- [ ] Vérifier les deux autres notifications (`notifyAgencyActivated`,
      `sendPasswordResetEmail`) : leurs valeurs viennent de la base, mais
      `agencyName` y a été saisi par l'agence — même traitement.
- [ ] `lib/csv.ts` — dans `escape()`, après la conversion en texte et
      **avant** la mise entre guillemets, préfixer d'une apostrophe simple
      les valeurs dont le premier caractère est dangereux.
- [ ] Renforcer le commentaire d'en-tête de `csv.ts` : il explique déjà le
      point-virgule et le BOM ; ajouter le troisième détail qui compte.

---

## Notes de développement

**Le quoting CSV ne protège de rien.** `"=HYPERLINK(...)"` est déquoté par
le tableur *avant* évaluation : la cellule redevient une formule. Seul le
préfixe apostrophe force le mode texte. C'est vérifié dans le rapport de
bugs, sortie d'export à l'appui.

**Ordre des opérations dans `escape()`.** Préfixer d'abord, échapper les
guillemets ensuite. L'inverse produirait une apostrophe à l'intérieur des
guillemets, sans effet.

**Ne pas assainir à l'entrée.** Nettoyer le message d'un lead au moment de
l'enregistrement ferait perdre le contenu réel — l'agence a besoin de lire
ce que le visiteur a écrit. Le bon endroit est la sortie, et il diffère
selon le canal : HTML pour l'email, apostrophe pour le CSV, rien pour
l'affichage web où React échappe déjà.

---

## Tests

- Insérer un lead dont le nom est `=1+1` et le message
  `<a href="http://evil.test">clic</a>`.
- Exporter `/api/export/leads` : la première cellule doit commencer par `'`.
- Sans SMTP, l'email part dans `.mail/` : ouvrir le fichier `.eml` et
  vérifier que la balise apparaît en texte.
