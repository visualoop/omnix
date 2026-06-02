import * as migration_20260602_100915 from './20260602_100915';

export const migrations = [
  {
    up: migration_20260602_100915.up,
    down: migration_20260602_100915.down,
    name: '20260602_100915'
  },
];
