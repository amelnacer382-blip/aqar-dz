import { test, expect } from "@playwright/test"
import { readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"

/**
 * Ce fichier ne teste PAS le produit servi. Il lit un fichier sur le disque.
 *
 * C'est delibere, et c'est faible : il faut le dire plutot que de laisser
 * croire le contraire.
 *
 * La suite qui l'entoure sert l'application EN DIRECT sur `:3002`
 * (`playwright.config.ts`, bloc `webServer`). nginx n'est jamais dans son
 * chemin — c'est REP-95. Elle ne peut donc pas attraper une regression du
 * relais, et aucune assertion posee ici ne le pourra non plus.
 *
 * BUG-36 (15-08-2026) : `proxy_set_header Host $host;` ne transmet pas le
 * port. Next 14 en derive `x-forwarded-host`, le compare a l'`Origin` du
 * navigateur — qui, lui, porte `:8095` — et refuse l'action au titre de sa
 * protection anti-CSRF. Les 41 Server Actions du produit repondaient 500,
 * pendant que les 121 cas de cette suite restaient verts.
 *
 * Ce que ce fichier attrape : que quelqu'un remette `$host` sans le savoir.
 * Ce qu'il n'attrape pas : que le relais cesse de fonctionner pour une
 * autre raison. La preuve reelle, bout en bout, est `npm run verify:deploy`
 * (voir `scripts/verify-deploy.mjs`) — lance a la main, dans la procedure
 * de deploiement. Arbitrage de la story 5.14, rendu le 15-08-2026 :
 * l'assertion statique tourne toujours, le script prouve vraiment ; un
 * projet Playwright qui se saute quand la pile est eteinte a ete ecarte,
 * parce qu'un test ignore se lit comme un test vert.
 */

const CONFIG = join(__dirname, "..", "nginx", "nginx.conf")
const DOCKERFILE = join(__dirname, "..", "docker", "Dockerfile")
const COMPOSE_PROD = join(__dirname, "..", "docker-compose.prod.yml")

/**
 * Le marqueur que `docker/Dockerfile` grave dans l'image (story 2.8).
 *
 * Ici on l'ecrit A LA RACINE DU DEPOT, parce que la suite sert
 * l'application depuis le depot (`playwright.config.ts`, bloc `webServer` :
 * `npm run build && npm start`) : `process.cwd()` y vaut la racine, comme
 * il vaut `/app` en conteneur.
 */
const MARQUEUR = join(__dirname, "..", ".commit")

/** Un SHA de forme valide, qui ne designe aucun commit de ce depot. */
const SHA_FACTICE = "abcdef0123456789abcdef0123456789abcdef01"

test.describe("Configuration de deploiement (lecture de fichier, pas du produit)", () => {
  test("nginx transmet le Host avec son port sur tous ses relais", () => {
    const conf = readFileSync(CONFIG, "utf-8")

    // Toutes les directives `proxy_set_header Host ...`, quelle qu'en soit
    // la valeur : on compte d'abord, on juge ensuite. Compter seulement les
    // lignes correctes laisserait un cinquieme bloc fautif passer dessous.
    // Boucle `exec` plutot que `matchAll` etale : la cible TypeScript du
    // projet n'autorise pas l'etalement d'un iterateur (TS2802).
    const motif = /^\s*proxy_set_header\s+Host\s+([^;]+);/gm
    const relais: string[] = []
    let trouve: RegExpExecArray | null

    while ((trouve = motif.exec(conf)) !== null) {
      relais.push(trouve[1].trim())
    }

    // Quatre blocs `location` relaient vers l'application : /_next/static,
    // /api, /api/upload et /. Le dernier porte les Server Actions, mais
    // l'invariant du fichier veut que nginx ecrase toujours ce que le
    // client a ecrit — il vaut donc pour les quatre, ou pour aucun.
    expect(
      relais.length,
      "nginx.conf doit poser Host sur ses quatre blocs location ; " +
        "un bloc ajoute sans cette ligne relaierait un Host non maitrise"
    ).toBe(4)

    // `$host` est l'en-tete Host normalise SANS le port. C'est exactement
    // ce qui a produit BUG-36.
    expect(
      relais,
      "un relais transmet un Host sans port : les Server Actions repondront 500 " +
        "derriere nginx (BUG-36). Attendu : $http_host"
    ).toEqual(["$http_host", "$http_host", "$http_host", "$http_host"])
  })

  /**
   * BUG-37, story 2.6. La sonde de sante compare les migrations que l'image
   * embarque a celles que la base a appliquees — mais elle ne peut le faire
   * que si le dossier EST dans l'image, et la sortie autonome de Next ne
   * trace pas `prisma/`.
   *
   * Sans cette recopie, la sonde repond 503 « incomparable » : le
   * deploiement echoue bruyamment plutot que silencieusement, ce qui est
   * voulu. L'assertion existe pour que la ligne ne disparaisse pas
   * discretement lors d'un nettoyage du Dockerfile — le cout se paierait au
   * deploiement suivant, loin de la modification qui l'a cause.
   *
   * Meme faiblesse assumee que le test ci-dessus : on lit un fichier, on
   * n'eprouve pas une image construite.
   */
  test("le Dockerfile embarque les migrations dans l'image de production", () => {
    const recette = readFileSync(DOCKERFILE, "utf-8")

    // Uniquement l'etage `production` : le builder a le depot entier, sa
    // copie ne prouve rien sur ce qui est SERVI.
    const production = recette.slice(recette.indexOf("FROM base AS production"))

    expect(
      production,
      "l'etage production ne recopie pas prisma/migrations : la sonde de " +
        "sante repondra 503 « incomparable » et le conteneur ne sera jamais " +
        "declare sain (BUG-37, story 2.6)"
    ).toMatch(/COPY[^\n]*\/app\/prisma\/migrations\s+\.\/prisma\/migrations/)
  })

  /**
   * BUG-25, story 3.6. `app/robots.ts` etait prerendu pendant `next build`,
   * donc GELE avec la valeur de `NEXTAUTH_URL` de la construction — dans
   * une image, celle du `Dockerfile:40`.
   *
   * MESURE DU 17-08-2026, avant correction. Une construction avec une
   * adresse, un service avec une autre, le meme serveur repondant aux deux
   * requetes :
   *
   *   /robots.txt   ->  Sitemap: http://construction.invalid/sitemap.xml
   *   /sitemap.xml  ->  <loc>http://execution.invalid</loc>
   *
   * Le fichier voisin, lui, portait deja `force-dynamic`. La preuve etait
   * aussi sur le disque : `.next/server/app/robots.txt.body` existait,
   * `sitemap` n'avait que son `route.js`.
   *
   * POURQUOI CETTE ASSERTION EST STATIQUE, ET NE PEUT PAS ETRE AUTRE CHOSE.
   * `playwright.config.ts` construit ET sert avec le MEME environnement :
   * la valeur gelee et la valeur d'execution sont identiques, donc l'ecart
   * est structurellement invisible d'ici. C'est la famille de REP-95. La
   * preuve reelle est `npm run verify:deploy`, qui attaque la pile servie.
   */
  test("robots.txt est calcule a l'appel, et non fige a la construction", () => {
    const sansCommentaires = (chemin: string) =>
      readFileSync(chemin, "utf-8")
        .split("\n")
        .filter((l) => {
          const t = l.trim()
          return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*")
        })
        .join("\n")

    const MOTIF = /^export const dynamic = "force-dynamic"$/m

    // CONTROLE POSITIF DE L'ASSERTION ELLE-MEME. Le plan du site porte
    // cette ligne depuis la story 1.3 : si le motif ci-dessus etait mal
    // ecrit, ce premier cas rougirait, et on ne mettrait pas l'echec du
    // second sur le dos du code.
    //
    // Le fichier a change de nom le 17-08-2026 (story 3.12) : `app/sitemap.ts`
    // ne pouvait produire qu'un `<urlset>`, il est devenu un index et deux
    // gestionnaires de route. La ligne, elle, n'a pas bouge de raison.
    expect(
      sansCommentaires(join(__dirname, "..", "app", "sitemap.xml", "route.ts")),
      "app/sitemap.xml/route.ts ne porte plus force-dynamic : soit la " +
        "regression est la, soit le motif de ce test est faux — les deux se " +
        "corrigent ici"
    ).toMatch(MOTIF)

    // La partie aussi : c'est elle qui porte les URL, et c'est donc elle
    // qui les gelerait.
    expect(
      sansCommentaires(
        join(__dirname, "..", "app", "sitemap", "[partie]", "route.ts")
      ),
      "app/sitemap/[partie]/route.ts ne porte plus force-dynamic : les URL " +
        "des vitrines seraient figees a l'adresse de construction"
    ).toMatch(MOTIF)

    expect(
      sansCommentaires(join(__dirname, "..", "app", "robots.ts")),
      "app/robots.ts est prerendu pendant `next build` : le robots.txt servi " +
        "annoncera le sitemap sur l'ADRESSE DE CONSTRUCTION, pas sur le " +
        "domaine reel (BUG-25). La suite ne peut pas voir cet ecart — elle " +
        "construit et sert avec le meme environnement"
    ).toMatch(MOTIF)
  })

  /**
   * REP-103, story 2.7. `docker compose down -v` supprime les volumes
   * ORDINAIRES et epargne ceux declares `external`. Mesure du 17-08-2026,
   * sur un projet jetable, avec un marqueur depose dans chaque volume :
   *
   *   ordinaire  ->  Volume t7_postgres_data Removed   (marqueur perdu)
   *   external   ->  `down -v` ne mentionne meme pas le volume, marqueur intact
   *
   * Ces deux volumes portent la base et TOUS les fichiers televerses, et
   * aucune sauvegarde automatique n'existe encore (story 0.1) : leur
   * effacement est definitif.
   *
   * `name:` compte autant que `external:`. Sans lui, Compose chercherait un
   * volume litteralement nomme `postgres_data` — qui n'existe pas — et la
   * pile ne demarrerait plus (`external volume "…" not found`, sortie 1).
   * L'assertion verifie donc les deux, et le nom au caractere pres.
   *
   * MEME FAIBLESSE ASSUMEE que les deux tests ci-dessus, et il faut la
   * redire : ceci lit un fichier. Ca ne prouve pas que `down -v` epargne
   * quoi que ce soit — cette preuve-la est la mutation jouee a la main sur
   * un projet jetable, decrite dans la story. Ce test empeche seulement la
   * declaration de disparaitre discretement, ce qui se paierait un jour ou
   * personne ne ferait le lien.
   */
  test("les volumes de production sont hors de portee d'un `down -v`", () => {
    const compose = readFileSync(COMPOSE_PROD, "utf-8")

    // Le bloc `volumes:` de premier niveau, en fin de fichier. Les services
    // ont aussi des `volumes:`, mais leurs entrees sont des elements de
    // liste (`      - uploads_data:/…`) : une cle a exactement deux espaces
    // n'existe que dans le bloc de premier niveau.
    const declaration = compose.slice(compose.search(/^volumes:$/m))

    const attendus = {
      postgres_data: "aqar-prod_postgres_data",
      uploads_data: "aqar-prod_uploads_data",
    }

    for (const [cle, nom] of Object.entries(attendus)) {
      // La cle, puis toutes les lignes plus indentees qui la suivent.
      const bloc = new RegExp(`^  ${cle}:\\n((?:    .*\\n)*)`, "m").exec(declaration)

      expect(bloc, `le volume \`${cle}\` n'est plus declare dans docker-compose.prod.yml`).not.toBeNull()

      expect(
        bloc?.[1] ?? "",
        `le volume \`${cle}\` n'est plus \`external: true\` : un ` +
          "`docker compose down -v` effacerait " +
          (cle === "postgres_data" ? "la base" : "toutes les photos et pieces televerses") +
          " (REP-103, story 2.7)"
      ).toMatch(/^\s*external:\s*true\s*$/m)

      expect(
        bloc?.[1] ?? "",
        `le volume \`${cle}\` doit porter \`name: ${nom}\` — sans ce nom exact, ` +
          "Compose chercherait un volume inexistant et la pile ne demarrerait plus"
      ).toMatch(new RegExp(`^\\s*name:\\s*${nom}\\s*$`, "m"))
    }
  })

  /**
   * REP-96, story 2.8. Le SHA du commit entre dans l'image par un `ARG` et
   * y est grave dans un FICHIER. Les deux moities comptent, et aucune n'est
   * eprouvee par la suite qui sert l'application depuis le depot : rien ici
   * ne construit d'image. Ces deux assertions empechent seulement le
   * cablage de disparaitre discretement — meme faiblesse assumee que les
   * trois tests ci-dessus, et le vrai controle est `npm run verify:deploy`
   * apres reconstruction.
   *
   * POURQUOI UN FICHIER ET NON UNE `ENV` : mesure du 17-08-2026, sur une
   * image jetable portant les deux. `docker run -e COMMIT_SHA=x` — soit
   * exactement ce que fait `env_file: - .env` — ECRASE l'`ENV` gravee et ne
   * peut rien contre le fichier. Une `ENV` ferait donc annoncer a la sonde
   * un commit qui n'est pas celui de l'image.
   */
  test("le Dockerfile grave le commit dans l'image de production", () => {
    const recette = readFileSync(DOCKERFILE, "utf-8")

    // Uniquement l'etage `production` : un ARG declare dans le builder ne
    // dit rien de ce qui est SERVI.
    const etage = recette.slice(recette.indexOf("FROM base AS production"))

    // LES COMMENTAIRES SONT RETIRES, et ce n'est pas de la coquetterie.
    // Ceux de ce Dockerfile sont longs et CITENT les instructions qu'ils
    // motivent : la premiere version de ce test a trouve « USER nextjs »
    // dans une phrase qui expliquait pourquoi la gravure devait le
    // preceder, et a echoue sur un fichier parfaitement correct. Un test
    // qui lit un fichier ne doit juger que ses instructions.
    const production = etage
      .split("\n")
      .filter((ligne) => !ligne.trimStart().startsWith("#"))
      .join("\n")

    expect(
      production,
      "l'etage production ne declare plus `ARG COMMIT_SHA` : le SHA n'a plus " +
        "aucun moyen d'entrer dans l'image, et la sonde repondra « inconnu » " +
        "en permanence (REP-96, story 2.8)"
    ).toMatch(/^\s*ARG\s+COMMIT_SHA/m)

    expect(
      production,
      "l'etage production n'ecrit plus le marqueur `.commit` : lib/version.ts " +
        "ne trouvera rien a lire et la sonde repondra « inconnu » en permanence"
    ).toMatch(/COMMIT_SHA"?\s*>\s*\.?\/?\.commit/)

    // L'ordre, et ce n'est pas du style : le marqueur est ecrit par root
    // avant le changement d'utilisateur. Deplace apres `USER nextjs`, le
    // `printf` echouerait — /app appartient a root — et la CONSTRUCTION
    // casserait, loin d'ici.
    expect(
      production.indexOf(".commit"),
      "le marqueur `.commit` est ecrit apres `USER nextjs` : nextjs ne peut " +
        "pas ecrire a la racine de /app, la construction de l'image echouera"
    ).toBeLessThan(production.indexOf("USER nextjs"))
  })

  test("docker-compose.prod.yml transmet le commit au service frontend", () => {
    const compose = readFileSync(COMPOSE_PROD, "utf-8")

    // Le bloc du service `frontend` seul : `migrate` et `seed` construisent
    // la meme recette sur l'etage `builder`, qui ne sert jamais de trafic.
    const frontend = compose.slice(
      compose.indexOf("  frontend:"),
      compose.indexOf("  nginx:")
    )

    expect(
      frontend,
      "le service `frontend` ne passe plus COMMIT_SHA en argument de build : " +
        "l'ARG du Dockerfile gardera sa valeur par defaut (vide) et la sonde " +
        "repondra « inconnu » a chaque deploiement (REP-96, story 2.8)"
    ).toMatch(/^\s*COMMIT_SHA:\s*\$\{COMMIT_SHA:-\}\s*$/m)
  })
})

/**
 * Ceux-la, EUX, interrogent le produit REELLEMENT SERVI.
 *
 * C'est le seul endroit de la story 2.8 ou l'on eprouve autre chose qu'un
 * fichier sur le disque, et il compte double : le cablage Docker n'est
 * garde que statiquement, mais la LECTURE du marqueur et le repli
 * « inconnu » sont ici prouves sur la sonde qui repond.
 *
 * SERIALISES entre eux : les deux cas se distinguent par la PRESENCE du
 * marqueur a la racine du depot, qui est un etat partage par le serveur.
 * Les jouer en parallele les rendrait mutuellement faux.
 *
 * Cohabitation avec `api-acces.spec.ts`, qui interroge la meme sonde en
 * parallele : verifie, il n'assert que le code 200, jamais le corps.
 */
test.describe.serial("Le commit servi (sonde reelle, story 2.8)", () => {
  // Garde d'entree : un exemplaire laisse par une execution interrompue
  // rendrait le premier cas faux pour une raison sans rapport.
  test.beforeEach(() => {
    rmSync(MARQUEUR, { force: true })
  })

  // `afterEach`, JAMAIS `finally` (CLAUDE.md §6) : un depassement de delai
  // n'execute pas un `finally`, et le marqueur resterait a la racine.
  test.afterEach(() => {
    rmSync(MARQUEUR, { force: true })
  })

  test("sans marqueur, la sonde dit « inconnu » plutot que d'omettre le champ", async ({
    request,
  }) => {
    const sante = await request.get("/api/public/health", {
      failOnStatusCode: false,
    })
    const corps = await sante.json()

    // LE CHAMP DOIT EXISTER. C'est la moitie du critere : un champ absent
    // se lit comme « ce produit est trop ancien pour le dire »,
    // indiscernable de « ce produit ne sait pas d'ou il vient » — et les
    // deux appellent des gestes differents.
    expect(
      Object.keys(corps),
      "la sonde n'expose plus de champ `commit` : une verification ne peut " +
        "plus savoir quelle version tourne (REP-96, story 2.8)"
    ).toContain("commit")

    expect(
      corps.commit,
      "sans marqueur, la sonde doit dire « inconnu » explicitement"
    ).toBe("inconnu")
  })

  test("avec un marqueur, la sonde rend le commit qu'il porte", async ({
    request,
  }) => {
    // Le CONTROLE POSITIF (CLAUDE.md §6). Sans lui, une fonction cassee qui
    // rendrait toujours « inconnu » donnerait exactement le meme vert que
    // le cas ci-dessus.
    writeFileSync(MARQUEUR, `${SHA_FACTICE}\n`, "utf-8")

    const sante = await request.get("/api/public/health", {
      failOnStatusCode: false,
    })
    const corps = await sante.json()

    expect(
      corps.commit,
      "le marqueur est present et la sonde ne le rend pas : lib/version.ts " +
        "ne lit plus le fichier, ou le met en cache — auquel cas le premier " +
        "etat vu par le processus serait fige pour toujours"
    ).toBe(SHA_FACTICE)
  })
})
