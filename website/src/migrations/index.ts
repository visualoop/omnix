import * as migration_20260602_101348 from './20260602_101348';
import * as migration_20260603_194237_seo_cloudbackups_settings from './20260603_194237_seo_cloudbackups_settings';
import * as migration_20260608_080000_license_variant from './20260608_080000_license_variant';

export const migrations = [
  {
    up: migration_20260602_101348.up,
    down: migration_20260602_101348.down,
    name: '20260602_101348',
  },
  {
    up: migration_20260603_194237_seo_cloudbackups_settings.up,
    down: migration_20260603_194237_seo_cloudbackups_settings.down,
    name: '20260603_194237_seo_cloudbackups_settings'
  },
  {
    up: migration_20260608_080000_license_variant.up,
    down: migration_20260608_080000_license_variant.down,
    name: '20260608_080000_license_variant',
  },
];
