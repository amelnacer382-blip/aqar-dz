import type { Metadata } from "next"

/** Voir app/auth/login/layout.tsx : page cliente, titre porte par le layout. */
export const metadata: Metadata = {
  title: "Créer mon agence",
  description:
    "Ouvrez le compte de votre agence immobilière sur Aqar DZ et publiez votre vitrine en ligne.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
