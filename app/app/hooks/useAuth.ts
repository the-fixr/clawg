'use client';

import { useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getSignableMessage, buildAuthToken, type AuthAction } from '../lib/auth';

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const getAuthToken = useCallback(
    async (action: AuthAction): Promise<string> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const message = await getSignableMessage(address, action);
      const signature = await signMessageAsync({ message });
      return buildAuthToken(message, signature, address);
    },
    [address, signMessageAsync]
  );

  return {
    address,
    isConnected,
    getAuthToken,
  };
}
