import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_machines_currency" AS ENUM('KES', 'USD', 'NGN', 'GHS', 'ZAR', 'TZS', 'UGX', 'RWF', 'EGP', 'INR', 'GBP', 'EUR', 'AED', 'ZMW', 'XAF', 'XOF');
  ALTER TABLE "machines" ADD COLUMN "currency" "enum_machines_currency" DEFAULT 'KES';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "machines" DROP COLUMN "currency";
  DROP TYPE "public"."enum_machines_currency";`)
}
