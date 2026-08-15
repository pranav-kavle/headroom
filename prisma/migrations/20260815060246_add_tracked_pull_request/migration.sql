-- CreateEnum
CREATE TYPE "TrackedPullRequestState" AS ENUM ('open', 'merged', 'closed');

-- CreateTable
CREATE TABLE "tracked_pull_request" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "state" "TrackedPullRequestState" NOT NULL DEFAULT 'open',
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_pull_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_pull_request_artifact_id_key" ON "tracked_pull_request"("artifact_id");

-- CreateIndex
CREATE INDEX "tracked_pull_request_user_id_state_idx" ON "tracked_pull_request"("user_id", "state");

-- AddForeignKey
ALTER TABLE "tracked_pull_request" ADD CONSTRAINT "tracked_pull_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_pull_request" ADD CONSTRAINT "tracked_pull_request_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
