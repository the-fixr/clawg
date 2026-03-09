'use client';
import { useState, useEffect } from 'react';
import sdk from '@farcaster/miniapp-sdk';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const AMOUNTS = [1, 5, 10, 25];

export default function DevTip() {
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState(5);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { sdk.actions.ready(); }, []);

  async function handleTip() {
    if (!username.trim()) return setStatus('⚠️ Enter a Farcaster username');
    setLoading(true); setStatus('');
    try {
      const res = await fetch(`https://api.farcaster.xyz/v2/user-by-username?username=${username.replace('@','')}`);
      const data = await res.json();
      const addr = data?.result?.user?.verifiedAddresses?.eth_addresses?.[0] || data?.result?.user?.custodyAddress;
      if (!addr) { setStatus('❌ No wallet found for that username'); setLoading(false); return; }
      const amountHex = `0x${(BigInt(amount) * BigInt(1e6)).toString(16)}`;
      await sdk.actions.sendToken({ token: `eip155:8453/erc20:${USDC_BASE}`, amount: amountHex, recipientAddress: addr });
      setStatus(`✅ Tipped $${amount} USDC to @${username}!`);
    } catch (e: unknown) {
      setStatus(e instanceof Error && e.message.includes('rejected') ? '🚫 Transaction cancelled' : '❌ Failed to send tip');
    }
    setLoading(false);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-xl flex flex-col gap-5">
        <div className="text-center">
          <div className="text-4xl mb-1">💸</div>
          <h1 className="text-2xl font-bold text-violet-400">DevTip</h1>
          <p className="text-slate-400 text-sm">Send USDC to devs you love</p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-slate-300 font-medium">Farcaster Username</label>
          <div className="flex items-center bg-slate-700 rounded-xl px-3">
            <span className="text-slate-400">@</span>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="vitalik" className="bg-transparent flex-1 py-2.5 px-2 outline-none text-white placeholder-slate-500" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-slate-300 font-medium">Tip Amount (USDC)</label>
          <div className="grid grid-cols-4 gap-2">
            {AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(a)} className={`py-2 rounded-xl font-bold text-sm transition-all ${amount === a ? 'bg-violet-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>${a}</button>
            ))}
          </div>
        </div>
        <button onClick={handleTip} disabled={loading} className="bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-base">
          {loading ? '⏳ Sending...' : `Tip $${amount} USDC`}
        </button>
        {status && <p className="text-center text-sm text-slate-300 bg-slate-700 rounded-xl py-2 px-3">{status}</p>}
        <p className="text-xs text-slate-500 text-center">Powered by Base • USDC</p>
      </div>
    </main>
  );
}
