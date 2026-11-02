import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/mailer"

/**
 * robots.txt.
 *
 * Deux mondes cohabitent sous le meme domaine : les vitrines publiques des
 * agences, qui n'ont d'interet que si on les trouve, et l'espace de
 * gestion, qui n'a rien a faire dans un index.
 *
 * Les espaces prives sont deja proteges par l'authentification — ces regles
 * ne les protegent pas, elles evitent seulement que des URL de dossiers
 * apparaissent dans des resultats de recherche.
 */
/**
 * Calcule a chaque appel, jamais au moment de la construction.
 *
 * Sans cette ligne, Next prerendait ce fichier pendant `next build` — a
 * l'interieur de l'image, ou `NEXTAUTH_URL` vaut la valeur factice du
 * `Dockerfile:40`. Le `robots.txt` livre annoncait donc le sitemap sur
 * l'adresse de CONSTRUCTION, pendant que `/sitemap.xml`, lui, portait la
 * bonne : les deux fichiers voisins se contredisaient (BUG-25).
 *
 * MESURE DU 17-08-2026, avant correction — construit avec une adresse,
 * servi avec une autre, le meme serveur repondant aux deux requetes :
 *
 *   /robots.txt   ->  Sitemap: http://construction.invalid/sitemap.xml
 *   /sitemap.xml  ->  <loc>http://execution.invalid</loc>
 *
 * Le cout est plus faible encore que celui du sitemap, qui a pris la meme
 * decision pour la meme raison : cette fonction ne fait AUCUNE requete en
 * base. Elle assemble une chaine, sur une adresse que seuls les moteurs
 * visitent et que nginx limite deja en debit.
 */
export const dynamic = "force-dynamic"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/vitrine/"],
      // Seuls les documents sont exclus, pas /uploads/ en bloc.
      //
      // La regle visait les pieces d'identite (BUG-16). Mais /uploads/
      // heberge aussi les photos de biens, qui sont le contenu public de
      // la vitrine : les exclure les sortait de Google Images et privait
      // d'illustration les resultats du module designe prioritaire, sans
      // rien proteger de plus — ces documents ne sont plus servis depuis
      // ce chemin.
      disallow: [
        "/agency/",
        "/admin/",
        "/api/",
        "/auth/",
        "/uploads/documents/",
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  }
}
