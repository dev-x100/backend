CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "WebinarType" AS ENUM ('LIVE', 'RECORDED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "users" (
	"id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
	"name" TEXT NOT NULL,
	"email" TEXT NOT NULL,
	"password_hash" TEXT NOT NULL,
	"role" "Role" NOT NULL DEFAULT 'USER',
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webinars" (
	"id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
	"title" TEXT NOT NULL,
	"description" TEXT,
	"speaker" TEXT NOT NULL,
	"speaker_bio" TEXT,
	"image_url" TEXT,
	"date" TIMESTAMP(3) NOT NULL,
	"duration_min" INTEGER NOT NULL DEFAULT 60,
	"category" TEXT NOT NULL,
	"type" "WebinarType" NOT NULL DEFAULT 'LIVE',
	"price" DECIMAL(10,2) NOT NULL DEFAULT 0,
	"seats" INTEGER NOT NULL DEFAULT 100,
	"is_published" BOOLEAN NOT NULL DEFAULT true,
	"zoom_meeting_id" TEXT,
	"zoom_join_url" TEXT,
	"zoom_start_url" TEXT,
	"zoom_password" TEXT,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,
	"created_by_id" TEXT NOT NULL,

	CONSTRAINT "webinars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registrations" (
	"id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
	"user_id" TEXT NOT NULL,
	"webinar_id" TEXT NOT NULL,
	"registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
	"stripe_session_id" TEXT,
	"stripe_payment_id" TEXT,
	"amount_paid" DECIMAL(10,2),
	"paid_at" TIMESTAMP(3),
	"reminder_sent_at" TIMESTAMP(3),

	CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
	"id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
	"name" TEXT NOT NULL,
	"email" TEXT NOT NULL,
	"company" TEXT,
	"message" TEXT NOT NULL,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_subscribers" (
	"id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
	"email" TEXT NOT NULL,
	"subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "registrations_user_id_webinar_id_key" ON "registrations"("user_id", "webinar_id");
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

ALTER TABLE "webinars"
	ADD CONSTRAINT "webinars_created_by_id_fkey"
	FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registrations"
	ADD CONSTRAINT "registrations_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registrations"
	ADD CONSTRAINT "registrations_webinar_id_fkey"
	FOREIGN KEY ("webinar_id") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
