import { supabase } from './supabase.js';
import { ReesuClient } from './reesuClient.js';

// Thrown when the user hasn't linked a Reesu account yet - callers should
// surface `message` as-is rather than the generic "❌ Error:" prefix.
export class ReesuAuthError extends Error {}

async function getStoredTokens(telegramId: number) {
  const { data, error } = await supabase
    .from('tele_users')
    .select('reesu_access_token, reesu_refresh_token')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;

  return {
    accessToken: (data?.reesu_access_token as string | null) ?? null,
    refreshToken: (data?.reesu_refresh_token as string | null) ?? null,
  };
}

async function persistTokens(telegramId: number, accessToken: string, refreshToken: string) {
  const { error } = await supabase
    .from('tele_users')
    .update({
      reesu_access_token: accessToken,
      reesu_refresh_token: refreshToken,
    })
    .eq('telegram_id', telegramId);
  if (error) throw error;
}

/**
 * Runs `fn` with the caller's linked Reesu access token. Access tokens
 * expire after 15 minutes (see reesu-builder-be's
 * ACCESS_TOKEN_EXPIRE_MINUTES) while Telegram usage is sporadic, so on a 401
 * this refreshes once via the stored refresh token, persists the new pair,
 * and retries `fn` before giving up.
 */
export async function withReesuAuth<T>(
  telegramId: number,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const { accessToken, refreshToken } = await getStoredTokens(telegramId);
  if (!accessToken) {
    throw new ReesuAuthError(
      'Please link your Reesu account first using /reesu_login [email] [password]',
    );
  }

  try {
    return await fn(accessToken);
  } catch (error: any) {
    if (error?.status !== 401 || !refreshToken) throw error;

    const tokens = await ReesuClient.refreshAccessToken(refreshToken);
    await persistTokens(telegramId, tokens.access_token, tokens.refresh_token);
    return await fn(tokens.access_token);
  }
}
