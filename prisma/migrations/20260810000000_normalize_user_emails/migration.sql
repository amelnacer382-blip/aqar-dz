-- Normalise les adresses email deja en base : minuscules, sans espaces de bord.
--
-- Le code normalise desormais toute adresse a l'entree. Sans ce rattrapage,
-- les comptes crees AVANT la correction deviendraient definitivement
-- inaccessibles : la connexion chercherait `contact@immoalger.dz` pendant que
-- la ligne porte encore `Contact@ImmoAlger.dz`. Le defaut serait aggrave par
-- son propre correctif.
--
-- Les deux tables sont traitees : `users.email` et `agencies.email` sont
-- toutes deux @unique, et la route d'inscription y ecrit la meme valeur.
--
-- Les collisions ne sont PAS resolues automatiquement. Deux lignes qui se
-- replient sur la meme adresse sont deux comptes distincts, avec chacun leur
-- historique : choisir lequel survit est une decision humaine. La migration
-- s'arrete en les listant plutot que de heurter la contrainte d'unicite avec
-- un message que personne ne sait lire.

DO $$
DECLARE
  conflits_users    text;
  conflits_agencies text;
  corriges_users    integer;
  corriges_agencies integer;
BEGIN
  SELECT string_agg(norme, ', ' ORDER BY norme) INTO conflits_users
  FROM (
    SELECT lower(btrim(email)) AS norme
    FROM users
    GROUP BY 1
    HAVING count(*) > 1
  ) c;

  SELECT string_agg(norme, ', ' ORDER BY norme) INTO conflits_agencies
  FROM (
    SELECT lower(btrim(email)) AS norme
    FROM agencies
    GROUP BY 1
    HAVING count(*) > 1
  ) c;

  -- Les deux controles sont faits AVANT toute ecriture, et les deux listes
  -- sont rapportees ensemble : corriger users pour rejouer et decouvrir
  -- ensuite un conflit sur agencies ferait perdre un aller-retour.
  IF conflits_users IS NOT NULL OR conflits_agencies IS NOT NULL THEN
    RAISE EXCEPTION E'Normalisation impossible : des adresses entrent en collision une fois mises en minuscules.\n  users    : %\n  agencies : %\nFusionnez ou supprimez les comptes concernes, puis rejouez la migration.',
      coalesce(conflits_users, '(aucune)'),
      coalesce(conflits_agencies, '(aucune)');
  END IF;

  UPDATE users
  SET email = lower(btrim(email))
  WHERE email <> lower(btrim(email));
  GET DIAGNOSTICS corriges_users = ROW_COUNT;

  UPDATE agencies
  SET email = lower(btrim(email))
  WHERE email <> lower(btrim(email));
  GET DIAGNOSTICS corriges_agencies = ROW_COUNT;

  RAISE NOTICE 'Emails normalises — users : %, agencies : %', corriges_users, corriges_agencies;
END $$;
