-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING_ON_DELIVERY';

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "txn_ref" DROP NOT NULL;
