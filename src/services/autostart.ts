/**
 * Wrapper around @tauri-apps/plugin-autostart
 * Lets users opt into "Start Omnix when Windows boots".
 */

import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function getAutostartEnabled(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function setAutostartEnabled(on: boolean): Promise<void> {
  if (on) await enable();
  else await disable();
}
