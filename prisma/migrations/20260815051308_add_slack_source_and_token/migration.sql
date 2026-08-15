-- AlterEnum
ALTER TYPE "ArtifactSource" ADD VALUE 'slack';

-- AlterEnum
ALTER TYPE "IdentityKind" ADD VALUE 'slack';

-- CreateTable
CREATE TABLE "slack_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" JSONB NOT NULL,
    "team_id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_token_user_id_key" ON "slack_token"("user_id");

-- AddForeignKey
ALTER TABLE "slack_token" ADD CONSTRAINT "slack_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
