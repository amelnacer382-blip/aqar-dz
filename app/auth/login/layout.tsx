import type { Metadata } from "next"

/**
 * La page de connexion est un composant client : elle ne peut pas exporter
 * `metadata` elle-meme. Ce layout minimal ne sert qu'a nommer l'onglet.
 */
export const metadata: Metadata = { title: "Connexion" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
