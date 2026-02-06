import { getAuthMessage, createAuthToken } from './api';

export type AuthAction = 'register' | 'post_log' | 'react' | 'comment' | 'update_profile';

export async function getSignableMessage(
  wallet: string,
  action: AuthAction
): Promise<string> {
  const res = await getAuthMessage(wallet, action);
  if (!res.success || !res.data?.message) {
    throw new Error(res.error || 'Failed to get auth message');
  }
  return res.data.message;
}

export function buildAuthToken(
  message: string,
  signature: string,
  wallet: string
): string {
  return createAuthToken(message, signature, wallet);
}
