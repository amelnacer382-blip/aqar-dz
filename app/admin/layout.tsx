/**
 * Meme raison que pour l'espace agence : les 5 pages d'administration
 * rendent deja leur propre <AdminNavbar /> et leur propre <main>. Les poser
 * ici aussi dupliquait la barre fixe et imbriquait deux <main>.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
