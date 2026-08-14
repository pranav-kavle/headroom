-- DropIndex
DROP INDEX "commitment_source_artifact_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "commitment_user_id_source_artifact_id_key" ON "commitment"("user_id", "source_artifact_id");
