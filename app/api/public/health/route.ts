import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ecartDeMigrations } from "@/lib/migrations"
import { commitServi } from "@/lib/version"

/**
 * Sonde de sante, interrogee par Docker et par le reverse proxy.
 *
 * Elle vit sous /api/public/ pour une raison precise : le middleware
 * refuse par defaut toute route API sans session, et une sonde qui repond
 * 401 declare le conteneur en panne alors qu'il va parfaitement bien.
 *
 * ELLE LIT UNE LIGNE TYPEE, PAS SEULEMENT `SELECT 1`. C'est BUG-37, et la
 * distinction a coute une panne totale le 16-08-2026 : la base portait
 * l'enumeration AgencyPlan pendant que l'image servait un client Prisma
 * genere sur `plan String`. Aucune connexion n'aboutissait — `authorize()`
 * relit l'agence a chaque fois — et cette sonde repondait `200`, mesure en
 * side-car contre la meme base. `SELECT 1` prouve la SOCKET, jamais la
 * DONNEE : il ne traverse aucune colonne, donc aucune enumeration.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  /**
   * Le commit servi, releve AVANT toute lecture de base.
   *
   * REP-96, story 2.8. Il est joint a TOUTES les reponses, y compris aux
   * 503 — et c'est delibere : c'est en panne qu'on a besoin de savoir
   * quelle image tourne. Une reponse « image-en-retard » sans le commit
   * laisse l'exploitant devant la question meme qui a coute du temps le
   * 15-08-2026.
   *
   * Le relever ici, hors de tout `try`, tient a une propriete de
   * `lib/version.ts` : il ne depend pas de Prisma. Le commit reste donc
   * connu quand la base est injoignable.
   */
  const commit = commitServi()

  /**
   * Premiere etape : la socket.
   *
   * Elle est gardee separement, et ce n'est pas de la redondance : c'est ce
   * qui permet de DISTINGUER « la base est injoignable » de « la base
   * repond mais ce client ne sait pas la lire ». Trancher sur la classe
   * d'erreur de Prisma serait plus court et plus fragile — la taxonomie des
   * erreurs d'une bibliotheque n'est pas un contrat.
   */
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    console.error("[health] base injoignable", error)

    return NextResponse.json(
      { status: "degraded", database: "down", commit },
      { status: 503 }
    )
  }

  /**
   * Seconde etape : la donnee.
   *
   * `Agency` et `User` d'abord parce que ce sont exactement les deux
   * modeles que `authorize()` lit (auth.ts:157). Une deserialisation qui
   * casse la met le produit A ZERO, pas un ecran : plus personne n'entre.
   * Les enumerations des autres modeles ne sont pas couvertes ici, et c'est
   * assume — la sonde tourne toutes les 30 s, elle doit rester bornee.
   *
   * `groupBy` PLUTOT QUE `findFirst`, ET CE N'EST PAS UN DETAIL DE STYLE.
   * La premiere version lisait UNE ligne avec ses colonnes d'enumeration.
   * La mutation du 16-08-2026 l'a DEMENTIE : client prive de la valeur
   * `pro`, base en contenant, la sonde est restee `200`. Motif — `findFirst`
   * rend une ligne ARBITRAIRE, et celle qu'elle rendait portait `starter`,
   * que le client mutant connaissait encore. Une lecture d'une ligne
   * n'eprouve que la valeur de cette ligne.
   *
   * `groupBy` rend UNE LIGNE PAR VALEUR DISTINCTE presente en base : toute
   * valeur inconnue du client leve, quelle que soit la ligne qui la porte.
   * Le cout reste borne — un `GROUP BY` sur une colonne a faible cardinalite
   * rend au plus autant de lignes que l'enumeration compte de valeurs.
   *
   * UNE BASE VIDE N'EST PAS UNE PANNE. `groupBy` rend un tableau vide sans
   * lever quand la table est vide : le premier demarrage d'une installation,
   * avant tout seed, reste donc `200`. C'est la moitie du critere, pas un
   * detail — une sonde qui refuse une base vierge casse l'installation
   * initiale, la seule qu'on fasse chez un client.
   */
  try {
    await Promise.all([
      prisma.agency.groupBy({ by: ["plan"] }),
      prisma.agency.groupBy({ by: ["status"] }),
      prisma.user.groupBy({ by: ["role"] }),
    ])
  } catch (error) {
    console.error("[health] schema illisible par ce client", error)

    return NextResponse.json(
      { status: "degraded", database: "up", schema: "incompatible", commit },
      { status: 503 }
    )
  }

  /**
   * Troisieme etape : l'ecart de migrations.
   *
   * Elle vient APRES la lecture typee et ne la remplace pas. La lecture
   * typee n'attrape la derive qu'une fois qu'une ligne l'exerce ; celle-ci
   * la voit des qu'elle existe, y compris sur une enumeration migree dont
   * aucune ligne ne porte encore la valeur neuve.
   *
   * LES NOMS SONT RENDUS, ET C'EST UN ARBITRAGE. Cette route est publique :
   * les nommer revele la chronologie des livraisons. Rendu le 16-08-2026,
   * motif ecrit pour qu'on puisse le rouvrir — un exploitant devant un
   * deploiement casse a besoin du NOM pour agir, la chronologie qu'il
   * revele est deja lisible sur la page tarifaire publique, et la reduction
   * a un simple decompte tient en une ligne si l'arbitrage change.
   */
  try {
    const ecart = await ecartDeMigrations()

    if (ecart.imageEnRetard.length > 0) {
      console.error(
        "[health] cette image ignore des migrations appliquees",
        ecart.imageEnRetard
      )

      return NextResponse.json(
        {
          status: "degraded",
          database: "up",
          schema: "image-en-retard",
          migrations: ecart.imageEnRetard,
          commit,
        },
        { status: 503 }
      )
    }

    if (ecart.baseEnRetard.length > 0) {
      console.error(
        "[health] des migrations embarquees ne sont pas appliquees",
        ecart.baseEnRetard
      )

      return NextResponse.json(
        {
          status: "degraded",
          database: "up",
          schema: "base-en-retard",
          migrations: ecart.baseEnRetard,
          commit,
        },
        { status: 503 }
      )
    }
  } catch (error) {
    /**
     * On ne sait pas comparer — dossier absent de l'image, table
     * `_prisma_migrations` inexistante. Ce n'est PAS un succes : une
     * comparaison impossible qui se lirait comme une comparaison reussie
     * est exactement le silence que cette story ferme.
     */
    console.error("[health] comparaison des migrations impossible", error)

    return NextResponse.json(
      { status: "degraded", database: "up", schema: "incomparable", commit },
      { status: 503 }
    )
  }

  return NextResponse.json({
    status: "ok",
    database: "up",
    schema: "a-jour",
    commit,
  })
}
