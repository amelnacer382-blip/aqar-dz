import { expect, Page } from "@playwright/test"

/**
 * Relever un formulaire SERVI, puis le rejouer en forcant ses champs.
 *
 * POURQUOI CE FICHIER EXISTE. Deux copies de cette mecanique vivaient deja
 * dans la suite — `tests/roles.spec.ts:868` (rejeu tel quel) et
 * `tests/plafonds.spec.ts:55` (rejeu avec champs forces). La story 4.8 en
 * demandait une troisieme. Elle est ecrite ici une fois, et les deux
 * copies existantes RESTENT EN PLACE a dessein : elles fonctionnent, elles
 * sont couvertes, et les migrer ferait toucher des tests verts pour un
 * benefice nul dans cette story. La consolidation appartient a la
 * story 4.7, qui refond le harnais.
 *
 * L'IDENTIFIANT D'ACTION N'EST JAMAIS ECRIT ICI. Il est calcule au
 * `build` : fige dans un test, il rendrait le cas vert en ne testant plus
 * rien (BUG-28, CLAUDE.md §6 piege 4). Il vient du HTML releve a
 * l'execution, et c'est toute la raison de relever le formulaire au lieu
 * de forger un POST.
 */

/**
 * Rend le HTML du formulaire servi sur `ecran`.
 *
 * `champTemoin` designe le formulaire : un ecran peut en porter plusieurs
 * (recherche, filtres, deconnexion dans la barre). Prendre `form` tout
 * court releverait le premier venu, et le rejeu partirait sur une action
 * qui n'a rien a voir — vert, et sans rapport avec ce qu'on croit prouver.
 */
export async function releverFormulaire(
  page: Page,
  ecran: string,
  champTemoin: string
): Promise<string> {
  await page.goto(ecran)

  const formulaire = page.locator(`form:has(${champTemoin})`)

  await expect(
    formulaire,
    `aucun formulaire portant ${champTemoin} sur ${ecran} — l'ecran a-t-il ` +
      `change de forme, ou la garde a-t-elle renvoye ailleurs ?`
  ).toBeAttached({ timeout: 15000 })

  return formulaire.evaluate((el) => (el as HTMLFormElement).outerHTML)
}

/**
 * Rejoue `formHtml` dans la session de `page`, en forcant `champs`.
 *
 * Les controles existants sont REMPLACES par des champs caches : un
 * `select` n'accepte pas une valeur absente de ses options, et un POST
 * n'utilise de toute facon pas l'ecran.
 *
 * `form.submit()` ne declenche aucun gestionnaire React : c'est
 * exactement le chemin d'un navigateur sans JavaScript, donc le point
 * d'entree reel de la Server Action.
 *
 * Rend l'URL d'arrivee. ELLE COMPTE : sur refus comme sur succes il y a
 * redirection, et c'est elle qui porte le message. Un appelant qui
 * constate que rien n'a ete cree peut ainsi DIRE POURQUOI plutot que de
 * laisser lire « la creation ne marche pas » sur un corps mal forme.
 */
export async function rejouer(
  page: Page,
  ecran: string,
  formHtml: string,
  champs: Record<string, string>
): Promise<string> {
  await page.goto(ecran)

  // L'ATTERRISSAGE SE VERIFIE. `action=""` se resout contre l'URL
  // COURANTE : si la garde renvoyait ailleurs, le POST partirait de cette
  // autre adresse, la navigation aurait bien lieu, et le test conclurait
  // sur une action qu'il n'a jamais atteinte.
  expect(
    new URL(page.url()).pathname,
    `le rejeu ne part pas de ${ecran} — le POST viserait une autre adresse`
  ).toBe(ecran)

  await Promise.all([
    // Un refus redirige, un succes aussi. Si aucune navigation n'a lieu,
    // le rejeu n'a pas abouti, et ce silence ne doit pas passer pour un
    // resultat. Jamais `networkidle` (CLAUDE.md §2).
    page.waitForNavigation({ timeout: 30000 }),
    page.evaluate(
      ({ html, valeurs }) => {
        const hote = document.createElement("div")
        hote.innerHTML = html

        const form = hote.querySelector("form") as HTMLFormElement

        for (const nom of Object.keys(valeurs)) {
          form.querySelector(`[name="${nom}"]`)?.remove()

          const champ = document.createElement("input")
          champ.type = "hidden"
          champ.name = nom
          champ.value = valeurs[nom]
          form.appendChild(champ)
        }

        document.body.appendChild(form)
        form.submit()
      },
      { html: formHtml, valeurs: champs }
    ),
  ])

  return decodeURIComponent(page.url())
}
