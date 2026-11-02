-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'agency_admin', 'agent');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('appartement', 'villa', 'studio', 'duplex', 'maison', 'residence', 'terrain_constructible', 'local_commercial', 'boutique', 'showroom', 'restaurant', 'cafe', 'magasin', 'bureau', 'cabinet_medical', 'espace_coworking', 'immeuble_professionnel', 'plateau_bureaux', 'hangar', 'entrepot', 'usine', 'depot', 'terrain_industriel', 'bungalow', 'villa_vacances', 'residence_estivale', 'appartement_saisonnier', 'chalet', 'maison_hotes', 'terrain_agricole', 'ferme', 'exploitation_agricole', 'serre_agricole', 'domaine_agricole');

-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('residentiel', 'commercial', 'professionnel', 'industriel', 'touristique', 'agricole');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('disponible', 'vendu', 'loue', 'reserve', 'archive');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('vente', 'location', 'gestion_locative');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('acheteur', 'locataire', 'investisseur', 'interesse');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('nouveau', 'interesse', 'visite_prevue', 'client_chaud', 'conclu', 'perdu');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('prevue', 'effectuee', 'annulee', 'reportee');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('negociation', 'compromis', 'vendu', 'annule');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('active', 'terminee', 'annulee');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('loyer', 'caution', 'commission_agence', 'frais_dossier', 'avance', 'paiement_proprietaire', 'abonnement_saas');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'virement', 'ccp', 'autre');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paye', 'partiel', 'impaye');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('contrat_vente', 'contrat_location', 'recu_paiement', 'fiche_bien', 'rapport_proprietaire', 'piece_identite', 'acte_propriete', 'image_bien', 'plan_bien');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('appel', 'email', 'sms', 'rendez_vous', 'visite', 'note', 'relance');

-- CreateEnum
CREATE TYPE "InterestLevel" AS ENUM ('tres_interesse', 'interesse', 'mitige', 'pas_interesse');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('nouveau', 'traite', 'archive');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificationtokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'agent',
    "agency_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "wilaya" TEXT,
    "commune" TEXT,
    "logo" TEXT,
    "status" "AgencyStatus" NOT NULL DEFAULT 'pending',
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "slug" TEXT,
    "description" TEXT,
    "showcase_enabled" BOOLEAN NOT NULL DEFAULT true,
    "primary_color" TEXT NOT NULL DEFAULT '#0f172a',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "PropertyCategory" NOT NULL,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'disponible',
    "operation_type" "OperationType" NOT NULL,
    "sale_price" DECIMAL(15,2),
    "rent_price" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "wilaya" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "quartier" TEXT,
    "address" TEXT,
    "surface" DOUBLE PRECISION,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "floor" INTEGER,
    "total_floors" INTEGER,
    "has_garage" BOOLEAN NOT NULL DEFAULT false,
    "has_garden" BOOLEAN NOT NULL DEFAULT false,
    "has_terrace" BOOLEAN NOT NULL DEFAULT false,
    "is_furnished" BOOLEAN NOT NULL DEFAULT false,
    "short_description" TEXT,
    "description" TEXT,
    "commission" DECIMAL(5,2),
    "agency_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "property_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "id_card_number" TEXT,
    "notes" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "budget" DECIMAL(15,2),
    "property_type" "PropertyType",
    "wilaya" TEXT,
    "category" "PropertyCategory",
    "type" "ClientType" NOT NULL DEFAULT 'interesse',
    "status" "ClientStatus" NOT NULL DEFAULT 'nouveau',
    "notes" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'prevue',
    "result" TEXT,
    "notes" TEXT,
    "interest_level" "InterestLevel",
    "rating" INTEGER,
    "price_feedback" TEXT,
    "follow_up_date" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "final_price" DECIMAL(15,2) NOT NULL,
    "commission" DECIMAL(15,2),
    "sale_date" TIMESTAMP(3) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'negociation',
    "documents" TEXT[],
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "monthly_rent" DECIMAL(15,2) NOT NULL,
    "deposit" DECIMAL(15,2),
    "agency_fees" DECIMAL(15,2),
    "status" "RentalStatus" NOT NULL DEFAULT 'active',
    "documents" TEXT[],
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_managements" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "rent_amount" DECIMAL(15,2) NOT NULL,
    "charges" DECIMAL(15,2),
    "expenses" DECIMAL(15,2),
    "commission" DECIMAL(15,2),
    "amount_to_owner" DECIMAL(15,2),
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "payment_date" TIMESTAMP(3),
    "receipt_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_managements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "status" "PaymentStatus" NOT NULL DEFAULT 'paye',
    "receipt" TEXT,
    "notes" TEXT,
    "property_id" TEXT,
    "client_id" TEXT,
    "owner_id" TEXT,
    "rental_id" TEXT,
    "sale_id" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT,
    "client_id" TEXT,
    "owner_id" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'nouveau',
    "property_id" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "mime_type" TEXT,
    "agency_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verificationtokens_token_key" ON "verificationtokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verificationtokens_identifier_token_key" ON "verificationtokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_email_key" ON "agencies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "properties_reference_key" ON "properties"("reference");

-- CreateIndex
CREATE INDEX "properties_agency_id_idx" ON "properties"("agency_id");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_operation_type_idx" ON "properties"("operation_type");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_wilaya_idx" ON "properties"("wilaya");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "properties"("deleted_at");

-- CreateIndex
CREATE INDEX "property_images_property_id_idx" ON "property_images"("property_id");

-- CreateIndex
CREATE INDEX "owners_agency_id_idx" ON "owners"("agency_id");

-- CreateIndex
CREATE INDEX "owners_deleted_at_idx" ON "owners"("deleted_at");

-- CreateIndex
CREATE INDEX "clients_agency_id_idx" ON "clients"("agency_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_deleted_at_idx" ON "clients"("deleted_at");

-- CreateIndex
CREATE INDEX "visits_agency_id_idx" ON "visits"("agency_id");

-- CreateIndex
CREATE INDEX "visits_client_id_idx" ON "visits"("client_id");

-- CreateIndex
CREATE INDEX "visits_property_id_idx" ON "visits"("property_id");

-- CreateIndex
CREATE INDEX "visits_status_idx" ON "visits"("status");

-- CreateIndex
CREATE INDEX "sales_agency_id_idx" ON "sales"("agency_id");

-- CreateIndex
CREATE INDEX "sales_property_id_idx" ON "sales"("property_id");

-- CreateIndex
CREATE INDEX "sales_client_id_idx" ON "sales"("client_id");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "rentals_agency_id_idx" ON "rentals"("agency_id");

-- CreateIndex
CREATE INDEX "rentals_property_id_idx" ON "rentals"("property_id");

-- CreateIndex
CREATE INDEX "rentals_client_id_idx" ON "rentals"("client_id");

-- CreateIndex
CREATE INDEX "rentals_status_idx" ON "rentals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rental_managements_reference_key" ON "rental_managements"("reference");

-- CreateIndex
CREATE INDEX "rental_managements_rental_id_idx" ON "rental_managements"("rental_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_managements_rental_id_month_year_key" ON "rental_managements"("rental_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_agency_id_idx" ON "payments"("agency_id");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_property_id_idx" ON "payments"("property_id");

-- CreateIndex
CREATE INDEX "payments_rental_id_idx" ON "payments"("rental_id");

-- CreateIndex
CREATE INDEX "interactions_agency_id_idx" ON "interactions"("agency_id");

-- CreateIndex
CREATE INDEX "interactions_client_id_idx" ON "interactions"("client_id");

-- CreateIndex
CREATE INDEX "interactions_owner_id_idx" ON "interactions"("owner_id");

-- CreateIndex
CREATE INDEX "leads_agency_id_idx" ON "leads"("agency_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "documents_agency_id_idx" ON "documents"("agency_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_agency_id_created_at_idx" ON "audit_logs"("agency_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_managements" ADD CONSTRAINT "rental_managements_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

