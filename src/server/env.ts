/**
 * Server configuration, read by either name.
 *
 * The app was called OutfitAI when its environment variables were named, so a
 * server that has been running since then has OUTFITAI_SECRET and
 * OUTFITAI_USERS in its .env. Preferring the new name and falling back to the
 * old one means the rename cannot sign anybody out or hide their wardrobe
 * behind a data directory the app suddenly cannot find — whether or not the
 * .env on the machine has been updated yet.
 *
 * Edge-safe: nothing here imports a node module, because middleware reads it.
 */
export function readEnv(name: 'SECRET' | 'USERS' | 'DATA_DIR' | 'INSECURE'): string | undefined {
  return process.env[`FITCHECK_${name}`] ?? process.env[`OUTFITAI_${name}`];
}
