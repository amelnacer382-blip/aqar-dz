import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

const bricolage = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-display",
  weight: "100 900",
});

const mono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
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
      <body className={`${geistSans.className} ${bricolage.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
