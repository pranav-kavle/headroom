-- CreateEnum
CREATE TYPE "IdentityKind" AS ENUM ('email', 'github', 'phone', 'spoken_name');

-- CreateEnum
CREATE TYPE "ArtifactSource" AS ENUM ('github', 'gmail', 'calendar', 'voice_note', 'google_health');

-- CreateEnum
CREATE TYPE "CommitmentDirection" AS ENUM ('owed_by_me', 'owed_to_me');

-- CreateEnum
CREATE TYPE "DuePrecision" AS ENUM ('exact', 'day', 'week', 'vague');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('open', 'at_risk', 'overdue', 'fulfilled', 'cancelled', 'superseded', 'rejected');

-- CreateEnum
CREATE TYPE "CommitmentEventKind" AS ENUM ('created', 'restated', 'moved', 'fulfilled', 'cancelled', 'superseded');

-- CreateEnum
CREATE TYPE "CapacitySignalKind" AS ENUM ('sleep', 'rhr', 'hrv', 'meeting_hours', 'free_hours');

-- CreateEnum
CREATE TYPE "ActionTier" AS ENUM ('tier_1', 'tier_2', 'tier_3', 'tier_4');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('proposed', 'executed', 'approved', 'undone', 'failed');

-- CreateEnum
CREATE TYPE "LabelVerdict" AS ENUM ('real', 'not_real', 'already_done');

-- CreateEnum
CREATE TYPE "ConnectorCursorStatus" AS ENUM ('idle', 'running', 'error');

-- AlterTable
ALTER TABLE "check_in" ADD COLUMN     "commitment_id" TEXT;

-- AlterTable
ALTER TABLE "recommendation_outcome" ADD COLUMN     "commitment_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "self_person_id" TEXT;

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "primary_email" TEXT,
    "github_login" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "kind" "IdentityKind" NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "ArtifactSource" NOT NULL,
    "external_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "author_person_id" TEXT,
    "excerpt" TEXT NOT NULL,
    "url" TEXT,
    "raw_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "direction" "CommitmentDirection" NOT NULL,
    "summary" TEXT NOT NULL,
    "counterparty_person_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "due_precision" "DuePrecision" NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'open',
    "confidence" DECIMAL(5,4) NOT NULL,
    "source_artifact_id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3),
    "closed_reason" TEXT,
    "superseded_by_commitment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitment_event" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "kind" "CommitmentEventKind" NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commitment_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_signal" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "CapacitySignalKind" NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "for_date" DATE NOT NULL,
    "source_artifact_id" TEXT NOT NULL,

    CONSTRAINT "capacity_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tier" "ActionTier" NOT NULL,
    "kind" TEXT NOT NULL,
    "commitment_id" TEXT,
    "status" "ActionStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "external_ref" TEXT,
    "executed_at" TIMESTAMP(3),
    "undone_at" TIMESTAMP(3),
    "agent_run_id" TEXT NOT NULL,

    CONSTRAINT "action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "verdict" "LabelVerdict" NOT NULL,
    "labeled_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_cursor" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "ArtifactSource" NOT NULL,
    "cursor" JSONB,
    "status" "ConnectorCursorStatus" NOT NULL DEFAULT 'idle',
    "last_synced_at" TIMESTAMP(3),
    "error_message" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_user_id_idx" ON "person"("user_id");

-- CreateIndex
CREATE INDEX "identity_person_id_idx" ON "identity"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_user_id_kind_value_key" ON "identity"("user_id", "kind", "value");

-- CreateIndex
CREATE INDEX "artifact_user_id_idx" ON "artifact"("user_id");

-- CreateIndex
CREATE INDEX "artifact_author_person_id_idx" ON "artifact"("author_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_user_id_source_external_id_key" ON "artifact"("user_id", "source", "external_id");

-- CreateIndex
CREATE INDEX "commitment_user_id_idx" ON "commitment"("user_id");

-- CreateIndex
CREATE INDEX "commitment_counterparty_person_id_idx" ON "commitment"("counterparty_person_id");

-- CreateIndex
CREATE INDEX "commitment_source_artifact_id_idx" ON "commitment"("source_artifact_id");

-- CreateIndex
CREATE INDEX "commitment_status_idx" ON "commitment"("status");

-- CreateIndex
CREATE INDEX "commitment_due_at_idx" ON "commitment"("due_at");

-- CreateIndex
CREATE INDEX "commitment_event_user_id_idx" ON "commitment_event"("user_id");

-- CreateIndex
CREATE INDEX "commitment_event_commitment_id_idx" ON "commitment_event"("commitment_id");

-- CreateIndex
CREATE INDEX "commitment_event_artifact_id_idx" ON "commitment_event"("artifact_id");

-- CreateIndex
CREATE INDEX "capacity_signal_source_artifact_id_idx" ON "capacity_signal"("source_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_signal_user_id_kind_for_date_key" ON "capacity_signal"("user_id", "kind", "for_date");

-- CreateIndex
CREATE INDEX "action_user_id_idx" ON "action"("user_id");

-- CreateIndex
CREATE INDEX "action_commitment_id_idx" ON "action"("commitment_id");

-- CreateIndex
CREATE INDEX "action_agent_run_id_idx" ON "action"("agent_run_id");

-- CreateIndex
CREATE INDEX "action_status_idx" ON "action"("status");

-- CreateIndex
CREATE INDEX "label_user_id_idx" ON "label"("user_id");

-- CreateIndex
CREATE INDEX "label_commitment_id_idx" ON "label"("commitment_id");

-- CreateIndex
CREATE UNIQUE INDEX "connector_cursor_user_id_source_key" ON "connector_cursor"("user_id", "source");

-- CreateIndex
CREATE INDEX "check_in_commitment_id_idx" ON "check_in"("commitment_id");

-- CreateIndex
CREATE INDEX "recommendation_outcome_commitment_id_idx" ON "recommendation_outcome"("commitment_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_self_person_id_key" ON "user"("self_person_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_self_person_id_fkey" FOREIGN KEY ("self_person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_author_person_id_fkey" FOREIGN KEY ("author_person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_counterparty_person_id_fkey" FOREIGN KEY ("counterparty_person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "artifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_superseded_by_commitment_id_fkey" FOREIGN KEY ("superseded_by_commitment_id") REFERENCES "commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_event" ADD CONSTRAINT "commitment_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_event" ADD CONSTRAINT "commitment_event_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_event" ADD CONSTRAINT "commitment_event_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_signal" ADD CONSTRAINT "capacity_signal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_signal" ADD CONSTRAINT "capacity_signal_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "artifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label" ADD CONSTRAINT "label_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label" ADD CONSTRAINT "label_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_cursor" ADD CONSTRAINT "connector_cursor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_outcome" ADD CONSTRAINT "recommendation_outcome_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

