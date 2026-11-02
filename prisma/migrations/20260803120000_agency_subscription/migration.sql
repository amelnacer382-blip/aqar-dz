-- Echeance d'abonnement de l'agence.
--
-- Il n'y a pas de prelevement automatique : l'encaissement se fait hors du
-- logiciel et l'editeur reporte ici la date couverte. Nullable, car une
-- agence en essai ou offerte n'a pas d'echeance suivie.
ALTER TABLE "agencies" ADD COLUMN "subscription_ends_at" TIMESTAMP(3);
