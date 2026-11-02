-- L'offre d'abonnement devient une valeur fermee.
--
-- Avant : `plan text NOT NULL DEFAULT 'basic'`. La colonne acceptait
-- n'importe quelle chaine, et les deux seules valeurs employees — `basic`
-- et `premium` — ne portaient aucun des noms vendus sur la page tarifaire
-- (Starter, Pro, Enterprise). L'offre etait une etiquette.
--
-- CE QUI EST RISQUE ICI, et ce qui le couvre. Prisma leve a la
-- deserialisation d'une valeur d'enumeration inconnue, et `requireAgency()`
-- relit l'agence a CHAQUE requete : une seule ligne non convertie
-- enfermerait l'agence entiere, ecran par ecran. Le `CASE` ci-dessous
-- porte donc un `ELSE` qui rabat TOUT le reste sur `starter` — valeur
-- inattendue, chaine vide, casse differente. Aucune ligne ne peut sortir
-- de cette conversion sans offre.
--
-- Starter est aussi le choix le moins-disant : une agence dont l'offre
-- n'etait pas connue ne recoit pas des capacites qu'elle n'a pas
-- demandees. Et rien ne se ferme sous ses pieds — aucun plafond n'est
-- applique par cette migration (story 6.4).

CREATE TYPE "AgencyPlan" AS ENUM ('starter', 'pro', 'enterprise');

-- Le defaut porte encore l'ancien type : il bloquerait l'ALTER TYPE.
ALTER TABLE "agencies" ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "agencies"
  ALTER COLUMN "plan" TYPE "AgencyPlan"
  USING (
    CASE lower(trim("plan"))
      WHEN 'premium'    THEN 'pro'
      WHEN 'pro'        THEN 'pro'
      WHEN 'enterprise' THEN 'enterprise'
      ELSE 'starter'
    END
  )::"AgencyPlan";

ALTER TABLE "agencies" ALTER COLUMN "plan" SET DEFAULT 'starter';
ALTER TABLE "agencies" ALTER COLUMN "plan" SET NOT NULL;
