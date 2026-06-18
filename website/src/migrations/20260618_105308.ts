import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pricing" ADD COLUMN "starter_price_k_e_s" numeric;
  ALTER TABLE "pricing" ADD COLUMN "starter_price_u_s_d" numeric;
  ALTER TABLE "pricing" ADD COLUMN "starter_price_n_g_n" numeric;
  ALTER TABLE "pricing" ADD COLUMN "starter_price_g_h_s" numeric;
  ALTER TABLE "pricing" ADD COLUMN "starter_price_z_a_r" numeric;
  ALTER TABLE "pricing" ADD COLUMN "business_price_k_e_s" numeric;
  ALTER TABLE "pricing" ADD COLUMN "business_price_u_s_d" numeric;
  ALTER TABLE "pricing" ADD COLUMN "business_price_n_g_n" numeric;
  ALTER TABLE "pricing" ADD COLUMN "business_price_g_h_s" numeric;
  ALTER TABLE "pricing" ADD COLUMN "business_price_z_a_r" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pricing" DROP COLUMN "starter_price_k_e_s";
  ALTER TABLE "pricing" DROP COLUMN "starter_price_u_s_d";
  ALTER TABLE "pricing" DROP COLUMN "starter_price_n_g_n";
  ALTER TABLE "pricing" DROP COLUMN "starter_price_g_h_s";
  ALTER TABLE "pricing" DROP COLUMN "starter_price_z_a_r";
  ALTER TABLE "pricing" DROP COLUMN "business_price_k_e_s";
  ALTER TABLE "pricing" DROP COLUMN "business_price_u_s_d";
  ALTER TABLE "pricing" DROP COLUMN "business_price_n_g_n";
  ALTER TABLE "pricing" DROP COLUMN "business_price_g_h_s";
  ALTER TABLE "pricing" DROP COLUMN "business_price_z_a_r";`)
}
