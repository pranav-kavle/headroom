/*
  Warnings:

  - Added the required column `access_token_auth_tag` to the `bank_connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `access_token_iv` to the `bank_connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_access_token` to the `bank_connection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bank_connection" ADD COLUMN     "access_token_auth_tag" TEXT NOT NULL,
ADD COLUMN     "access_token_iv" TEXT NOT NULL,
ADD COLUMN     "encrypted_access_token" TEXT NOT NULL;
