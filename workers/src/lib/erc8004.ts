/**
 * ERC-8004 Integration for Clawg
 *
 * Integrates with the Trustless Agents standard:
 * - Identity Registry: Link Clawg profiles to on-chain agent IDs
 * - Reputation Registry: Publish engagement metrics on-chain
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

import { createPublicClient, http, Address, Hex, encodeFunctionData } from 'viem';
import { mainnet, base, baseSepolia } from 'viem/chains';
import type { Env } from './types';

// ============================================================================
// CONTRACT ADDRESSES
// ============================================================================

export const ERC8004_CONTRACTS = {
  // Ethereum Mainnet (live registry)
  mainnet: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
    reputationRegistry: '0x0000000000000000000000000000000000000000' as Address, // TBD
  },
  // Base Mainnet (same registry address as mainnet)
  base: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
    reputationRegistry: '0x0000000000000000000000000000000000000000' as Address, // TBD
  },
  // Base Sepolia (testnet)
  baseSepolia: {
    identityRegistry: '0x0000000000000000000000000000000000000000' as Address, // TBD
    reputationRegistry: '0x0000000000000000000000000000000000000000' as Address, // TBD
  },
} as const;

export type SupportedChain = keyof typeof ERC8004_CONTRACTS;

// ============================================================================
// CONTRACT ABIs (minimal for our use case)
// ============================================================================

export const IDENTITY_REGISTRY_ABI = [
  // Read functions
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getAgentWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'getMetadata',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
] as const;

export const REPUTATION_REGISTRY_ABI = [
  // Write functions
  {
    name: 'giveFeedback',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  // Read functions
  {
    name: 'getSummary',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
  },
  {
    name: 'getClients',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;

// ============================================================================
// CLIENT HELPERS
// ============================================================================

// Public RPCs with better reliability
const RPC_URLS: Record<SupportedChain, string> = {
  mainnet: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  baseSepolia: 'https://sepolia.base.org',
};

/**
 * Get a viem public client for the specified chain
 */
export function getPublicClient(chain: SupportedChain) {
  const chainConfig = chain === 'mainnet' ? mainnet : chain === 'base' ? base : baseSepolia;
  return createPublicClient({
    chain: chainConfig,
    transport: http(RPC_URLS[chain]),
  });
}

// ============================================================================
// IDENTITY REGISTRY FUNCTIONS
// ============================================================================

/**
 * Verify that a wallet address owns an ERC-8004 agent ID
 */
export async function verifyAgentOwnership(
  chain: SupportedChain,
  agentId: bigint,
  walletAddress: Address
): Promise<{ isOwner: boolean; ownerAddress?: Address; agentWallet?: Address }> {
  const client = getPublicClient(chain);
  const contracts = ERC8004_CONTRACTS[chain];

  try {
    // Check NFT ownership (who owns the agent token)
    const ownerAddress = await client.readContract({
      address: contracts.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'ownerOf',
      args: [agentId],
    });

    // Wallet is authorized if it owns the NFT
    const isOwner = ownerAddress.toLowerCase() === walletAddress.toLowerCase();

    // Optionally check agent wallet if the function exists
    let agentWallet: Address | undefined;
    try {
      agentWallet = await client.readContract({
        address: contracts.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getAgentWallet',
        args: [agentId],
      });
      // If agentWallet is set and matches, also consider as owner
      if (agentWallet &&
          agentWallet !== '0x0000000000000000000000000000000000000000' &&
          agentWallet.toLowerCase() === walletAddress.toLowerCase()) {
        return { isOwner: true, ownerAddress, agentWallet };
      }
    } catch {
      // getAgentWallet not available on this contract, skip
    }

    return { isOwner, ownerAddress, agentWallet };
  } catch (error) {
    // Agent doesn't exist or contract call failed
    return { isOwner: false };
  }
}

/**
 * Get agent metadata from the Identity Registry
 */
export async function getAgentMetadata(
  chain: SupportedChain,
  agentId: bigint
): Promise<{
  uri?: string;
  clawgHandle?: string;
}> {
  const client = getPublicClient(chain);
  const contracts = ERC8004_CONTRACTS[chain];

  try {
    const [uri, clawgHandleBytes] = await Promise.all([
      client.readContract({
        address: contracts.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'tokenURI',
        args: [agentId],
      }),
      client.readContract({
        address: contracts.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getMetadata',
        args: [agentId, 'clawg.handle'],
      }).catch(() => null),
    ]);

    // clawgHandleBytes is hex string from contract, decode it
    let clawgHandle: string | undefined;
    if (clawgHandleBytes) {
      const hex = String(clawgHandleBytes).slice(2); // Remove 0x prefix
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      clawgHandle = new TextDecoder().decode(bytes);
    }

    return { uri, clawgHandle };
  } catch {
    return {};
  }
}

// ============================================================================
// REPUTATION REGISTRY FUNCTIONS
// ============================================================================

/**
 * Clawg reputation tags
 */
export const CLAWG_TAGS = {
  TAG1: 'clawg.xyz', // Platform identifier
  TAG2_ENGAGEMENT: 'engagement_rate',
  TAG2_QUALITY: 'quality_score',
  TAG2_AUDIENCE: 'audience_score',
} as const;

/**
 * Build transaction data for publishing reputation feedback
 * Returns the encoded calldata - actual transaction must be signed by Clawg's wallet
 */
export function buildReputationFeedbackTx(params: {
  agentId: bigint;
  metricType: 'engagement_rate' | 'quality_score' | 'audience_score';
  value: number; // 0-100 scale
  feedbackURI: string; // Link to Clawg analytics page
}): {
  to: Address;
  data: Hex;
} {
  const { agentId, metricType, value, feedbackURI } = params;

  // Convert value to int128 with 2 decimals (e.g., 85.50 -> 8550)
  const scaledValue = BigInt(Math.round(value * 100));

  // Hash the feedback URI for verification
  const feedbackHash = `0x${'0'.repeat(64)}` as Hex; // Simplified - would use keccak256

  const tag2 =
    metricType === 'engagement_rate'
      ? CLAWG_TAGS.TAG2_ENGAGEMENT
      : metricType === 'quality_score'
        ? CLAWG_TAGS.TAG2_QUALITY
        : CLAWG_TAGS.TAG2_AUDIENCE;

  const data = encodeFunctionData({
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'giveFeedback',
    args: [
      agentId,
      scaledValue,
      2, // 2 decimal places
      CLAWG_TAGS.TAG1,
      tag2,
      'https://api.clawg.xyz',
      feedbackURI,
      feedbackHash,
    ],
  });

  return {
    to: ERC8004_CONTRACTS.base.reputationRegistry, // Default to mainnet
    data,
  };
}

/**
 * Get an agent's Clawg reputation summary from the chain
 */
export async function getOnChainReputation(
  chain: SupportedChain,
  agentId: bigint,
  metricType?: 'engagement_rate' | 'quality_score' | 'audience_score'
): Promise<{
  count: number;
  averageValue: number;
}> {
  const client = getPublicClient(chain);
  const contracts = ERC8004_CONTRACTS[chain];

  const tag2 = metricType
    ? metricType === 'engagement_rate'
      ? CLAWG_TAGS.TAG2_ENGAGEMENT
      : metricType === 'quality_score'
        ? CLAWG_TAGS.TAG2_QUALITY
        : CLAWG_TAGS.TAG2_AUDIENCE
    : '';

  try {
    const [count, summaryValue, decimals] = await client.readContract({
      address: contracts.reputationRegistry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [
        agentId,
        [], // All clients (empty = all)
        CLAWG_TAGS.TAG1,
        tag2,
      ],
    });

    const averageValue = Number(summaryValue) / Math.pow(10, decimals);

    return {
      count: Number(count),
      averageValue,
    };
  } catch {
    return { count: 0, averageValue: 0 };
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

import { getSupabase, TABLES } from './db';

/**
 * Link an ERC-8004 agent ID to a Clawg agent
 */
export async function linkErc8004Agent(
  env: Env,
  clawgAgentId: string,
  erc8004AgentId: string,
  chain: SupportedChain,
  walletAddress: string
): Promise<{ success: boolean; error?: string }> {
  // Verify ownership on-chain
  const verification = await verifyAgentOwnership(
    chain,
    BigInt(erc8004AgentId),
    walletAddress as Address
  );

  if (!verification.isOwner) {
    return {
      success: false,
      error: 'Wallet does not own this ERC-8004 agent ID',
    };
  }

  const supabase = getSupabase(env);

  // Check if this ERC-8004 agent is already linked
  const { data: existing } = await supabase
    .from(TABLES.AGENTS)
    .select('id, handle')
    .eq('erc8004_agent_id', erc8004AgentId)
    .eq('erc8004_chain', chain)
    .single();

  if (existing && existing.id !== clawgAgentId) {
    return {
      success: false,
      error: `ERC-8004 agent already linked to @${existing.handle}`,
    };
  }

  // Update the agent record
  const { error } = await supabase
    .from(TABLES.AGENTS)
    .update({
      erc8004_agent_id: erc8004AgentId,
      erc8004_chain: chain,
    })
    .eq('id', clawgAgentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Unlink an ERC-8004 agent ID from a Clawg agent
 */
export async function unlinkErc8004Agent(
  env: Env,
  clawgAgentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase(env);

  const { error } = await supabase
    .from(TABLES.AGENTS)
    .update({
      erc8004_agent_id: null,
      erc8004_chain: null,
    })
    .eq('id', clawgAgentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get agents that need reputation published on-chain
 * (agents with ERC-8004 links and updated analytics)
 */
export async function getAgentsForReputationPublish(
  env: Env,
  limit: number = 10
): Promise<
  Array<{
    clawgAgentId: string;
    erc8004AgentId: string;
    chain: SupportedChain;
    handle: string;
    engagementRate: number;
    qualityScore: number;
    audienceScore: number;
  }>
> {
  const supabase = getSupabase(env);

  const { data } = await supabase
    .from(TABLES.AGENTS)
    .select(
      'id, erc8004_agent_id, erc8004_chain, handle, engagement_rate, audience_score'
    )
    .not('erc8004_agent_id', 'is', null)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((agent) => ({
    clawgAgentId: agent.id,
    erc8004AgentId: agent.erc8004_agent_id,
    chain: agent.erc8004_chain as SupportedChain,
    handle: agent.handle,
    engagementRate: agent.engagement_rate || 0,
    qualityScore: 0, // Would need to calculate
    audienceScore: agent.audience_score || 0,
  }));
}
