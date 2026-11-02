"use client"

/**
 * Dernier filet : une erreur survenue dans le layout racine lui-meme.
 *
 * A ce niveau, ni la mise en page ni les polices ne sont disponibles —
 * ce fichier remplace le document entier, il doit donc porter ses propres
 * balises html et body et ne dependre d'aucun composant du projet. Les
 * styles sont ecrits en ligne pour la meme raison : la feuille de style
 * peut etre precisement ce qui a echoue.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f4f5f3",
          color: "#12212B",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
            Aqar DZ est momentanément indisponible
          </h1>
          <p style={{ marginTop: "1rem", color: "#475569", lineHeight: 1.6 }}>
            Une erreur inattendue a interrompu le chargement. Rechargez la
            page ; si elle persiste, signalez-la en indiquant le code
            ci-dessous.
          </p>

          {error.digest && (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#64748b",
              }}
            >
              Code : {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              cursor: "pointer",
              border: "none",
              borderRadius: "0.5rem",
              backgroundColor: "#12212B",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              fontSize: "0.95rem",
            }}
          >
            Recharger la page
          </button>
        </div>
      </body>
    </html>
  )
}
