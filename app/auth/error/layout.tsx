import type { Metadata } from "next"

/** Voir app/auth/login/layout.tsx : page cliente, titre porte par le layout. */
export const metadata: Metadata = { title: "Erreur d'authentification" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
