-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('schedule', 'source_event', 'manual_feedback', 'threshold');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('running', 'ok', 'retrying', 'error');

-- CreateEnum
CREATE TYPE "CheckInChannel" AS ENUM ('ui', 'email');

-- CreateEnum
CREATE TYPE "DetectionMethod" AS ENUM ('self_report', 'inferred_txn');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trigger_event" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trigger_type" "TriggerType" NOT NULL,
    "payload" JSONB NOT NULL,
    "interpreted_as" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trigger_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trigger_event_id" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "langfuse_trace_id" TEXT,
    "token_cost" DECIMAL(10,4),
    "surfaced" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "agent_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_attempt" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "agent_run_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "decision_text" TEXT NOT NULL,
    "what_changed" TEXT,
    "materiality_reason" TEXT,
    "channel" "CheckInChannel" NOT NULL,
    "response" JSONB,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "check_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_outcome" (
    "id" TEXT NOT NULL,
    "recommended_amount" DECIMAL(14,2) NOT NULL,
    "acted" BOOLEAN,
    "observed_amount" DECIMAL(14,2),
    "detection_method" "DetectionMethod",
    "confidence" DECIMAL(5,4),
    "observed_at" TIMESTAMP(3),

    CONSTRAINT "recommendation_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_clerk_user_id_key" ON "user"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trigger_event_idempotency_key_key" ON "trigger_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "trigger_event_user_id_idx" ON "trigger_event"("user_id");

-- CreateIndex
CREATE INDEX "agent_run_user_id_idx" ON "agent_run"("user_id");

-- CreateIndex
CREATE INDEX "agent_run_trigger_event_id_idx" ON "agent_run"("trigger_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_run_attempt_agent_run_id_attempt_no_key" ON "agent_run_attempt"("agent_run_id", "attempt_no");

-- CreateIndex
CREATE INDEX "check_in_agent_run_id_idx" ON "check_in"("agent_run_id");

-- AddForeignKey
ALTER TABLE "trigger_event" ADD CONSTRAINT "trigger_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_event_id_fkey" FOREIGN KEY ("trigger_event_id") REFERENCES "trigger_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_attempt" ADD CONSTRAINT "agent_run_attempt_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
