/**
 * Server-side environment variable access with validation.
 * Throws at import time if required variables are missing.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGeminiApiKey(): string {
  return requireEnv('GEMINI_API_KEY');
}
