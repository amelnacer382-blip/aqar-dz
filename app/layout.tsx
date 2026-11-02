import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

/**
 * Bricolage Grotesque porte les titres : ses formes legerement condensees
 * et ses contreformes anguleuses donnent une voix a la marque, la ou un
 * grotesque neutre laisserait la page anonyme. Reservee aux titres.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

/**
 * Le travail d'agence est un travail de registre : references de biens,
 * montants, periodes. Une chasse fixe les aligne et les rend comparables.
 */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

/**
 * `metadataBase` fixe le domaine a partir duquel les adresses relatives des
 * partages sociaux sont resolues. Sans elle, une vitrine partagee sur
 * WhatsApp ou Facebook expose des chemins relatifs, que ces services ne
 * savent pas suivre.
 *
 * Le gabarit de titre donne son nom a chaque onglet : une agence travaille
 * avec Biens, Clients et Paiements ouverts cote a cote, et trois onglets
 * intitules « Aqar DZ » ne se distinguent pas.
 *
 * ⚠ PIEGE DORMANT — a lire avant d'ajouter une image de partage.
 *
 * `process.env.NEXTAUTH_URL` est lu A L'EVALUATION DU MODULE. Pour une page
 * PRERENDUE pendant `next build`, c'est donc l'adresse de CONSTRUCTION qui
 * est gelee dans le HTML livre — le defaut exact de BUG-25, referme sur
 * `app/robots.ts` par la story 3.6.
 *
 * MESURE DU 17-08-2026, sur la page d'accueil prerendue, avant de conclure :
 *
 *   grep -o 'localhost:[0-9]*' .next/server/app/index.html      -> aucun
 *   grep -o '<meta property="og:[^>]*>' .next/server/app/index.html
 *     -> og:title, og:description, og:site_name, og:locale, og:type
 *
 * Aucune adresse absolue n'est gelee AUJOURD'HUI, parce que `metadataBase`
 * ne sert qu'a resoudre des adresses RELATIVES et que le produit n'en
 * declare aucune. Ce n'est donc pas un defaut, et rien n'a ete change.
 *
 * Le jour ou l'on ajoute `openGraph.images: "/quelque-chose.png"` ou une
 * canonique, cette page devra passer en rendu dynamique — ou l'adresse
 * devra etre resolue a l'appel.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Aqar DZ — Le logiciel des agences immobilières algériennes",
    template: "%s · Aqar DZ",
  },
  description:
    "Gérez vos biens, vos clients, vos baux et vos loyers, et publiez votre vitrine en ligne. Conçu pour les agences immobilières en Algérie.",
  openGraph: {
    type: "website",
    locale: "fr_DZ",
    siteName: "Aqar DZ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} ${bricolage.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
