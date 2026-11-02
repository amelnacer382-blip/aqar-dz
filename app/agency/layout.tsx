/**
 * Ce layout ne pose volontairement aucun cadre.
 *
 * Chaque page de l'espace agence rend deja sa propre <AgencyNavbar /> et son
 * propre <main> — c'est la convention du projet, verifiee sur les 41 pages.
 * Les rendre ici aussi produisait une barre fixe en double, un <main>
 * imbrique dans un autre (deux reperes de contenu principal pour un lecteur
 * d'ecran) et une marge haute appliquee deux fois.
 */
export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
