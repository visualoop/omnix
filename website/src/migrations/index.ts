import * as migration_20260602_101348 from './20260602_101348';
import * as migration_20260603_194237_seo_cloudbackups_settings from './20260603_194237_seo_cloudbackups_settings';
import * as migration_20260608_080000_license_variant from './20260608_080000_license_variant';
import * as migration_20260608_104500_customer_verified_backfill from './20260608_104500_customer_verified_backfill';
import * as migration_20260608_111500_clear_customer_lockouts from './20260608_111500_clear_customer_lockouts';
import * as migration_20260608_112800_cleanup_probe_customers from './20260608_112800_cleanup_probe_customers';
import * as migration_20260608_152000_fix_variant_enum_naming from './20260608_152000_fix_variant_enum_naming';
import * as migration_20260609_091500_pricing_30k from './20260609_091500_pricing_30k';
import * as migration_20260610_093000_pricing_50_150 from './20260610_093000_pricing_50_150';
import * as migration_20260610_135417 from './20260610_135417';
import * as migration_20260610_133000_seed_site_content from './20260610_133000_seed_site_content';

export const migrations = [
  {
    up: migration_20260602_101348.up,
    down: migration_20260602_101348.down,
    name: '20260602_101348',
  },
  {
    up: migration_20260603_194237_seo_cloudbackups_settings.up,
    down: migration_20260603_194237_seo_cloudbackups_settings.down,
    name: '20260603_194237_seo_cloudbackups_settings',
  },
  {
    up: migration_20260608_080000_license_variant.up,
    down: migration_20260608_080000_license_variant.down,
    name: '20260608_080000_license_variant',
  },
  {
    up: migration_20260608_104500_customer_verified_backfill.up,
    down: migration_20260608_104500_customer_verified_backfill.down,
    name: '20260608_104500_customer_verified_backfill',
  },
  {
    up: migration_20260608_111500_clear_customer_lockouts.up,
    down: migration_20260608_111500_clear_customer_lockouts.down,
    name: '20260608_111500_clear_customer_lockouts',
  },
  {
    up: migration_20260608_112800_cleanup_probe_customers.up,
    down: migration_20260608_112800_cleanup_probe_customers.down,
    name: '20260608_112800_cleanup_probe_customers',
  },
  {
    up: migration_20260608_152000_fix_variant_enum_naming.up,
    down: migration_20260608_152000_fix_variant_enum_naming.down,
    name: '20260608_152000_fix_variant_enum_naming',
  },
  {
    up: migration_20260609_091500_pricing_30k.up,
    down: migration_20260609_091500_pricing_30k.down,
    name: '20260609_091500_pricing_30k',
  },
  {
    up: migration_20260610_093000_pricing_50_150.up,
    down: migration_20260610_093000_pricing_50_150.down,
    name: '20260610_093000_pricing_50_150',
  },
  {
    up: migration_20260610_133000_seed_site_content.up,
    down: migration_20260610_133000_seed_site_content.down,
    name: '20260610_133000_seed_site_content',
  },
  {
    up: migration_20260610_135417.up,
    down: migration_20260610_135417.down,
    name: '20260610_135417'
  },
];
