-- AlterTable
ALTER TABLE "user" ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "onboarded_at" TIMESTAMP(3),
ADD COLUMN     "role" TEXT,
ADD COLUMN     "timezone" TEXT;
