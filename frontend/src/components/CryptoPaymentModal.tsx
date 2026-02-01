/**
 * Crypto payment modal for Pro upgrade
 * Features: QR code, gas estimates, token selection, network switch, support email
 */
import { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, Loader2, ExternalLink, Crown, AlertCircle, Mail, Fuel, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface CryptoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentConfirmed: () => void;
}

interface PaymentInfo {
  payment_id: number;
  address: string;
  amount: string;
  amount_raw: number;
  amount_exact?: number;  // Float for display (e.g., 19.001)
  token: string;
  chain: string;
  chain_id: number;
  chain_name: string;
  token_contract: string;
  explorer: string;
  expires_at: string;
  status: string;
  qr_uri: string;
}

interface Chain {
  id: string;
  name: string;
  chain_id: number;
  tokens: string[];
  usdc_contract: string | null;
  usdt_contract: string | null;
  explorer: string;
  gas_estimate: {
    gas_price_gwei: number;
    gas_limit: number;
    estimated_cost_eth: number;
    estimated_cost_usd: number;
  };
}

export default function CryptoPaymentModal({ isOpen, onClose, onPaymentConfirmed }: CryptoPaymentModalProps) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState('polygon');
  const [selectedToken, setSelectedToken] = useState('usdc');
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [supportEmail, setSupportEmail] = useState('support@yourdomain.com');
  const [showQR, setShowQR] = useState(true);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);

  const { refreshUser } = useAuth();

  // Load supported chains and price (always fresh, no cached payments)
  useEffect(() => {
    if (isOpen) {
      // Reset payment state when modal opens - always start fresh
      setPayment(null);

      apiClient.getSupportedChains().then(({ chains, support_email, price_usd }) => {
        setChains(chains);
        setSupportEmail(support_email);
        setPriceUsd(price_usd);
      }).catch(console.error);
    }
  }, [isOpen]);

  // Poll for payment status when payment is created
  useEffect(() => {
    if (!payment || payment.status !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const result = await apiClient.checkPaymentStatus(payment.payment_id);
        if (result.status === 'confirmed') {
          setPayment({ ...payment, status: 'confirmed' });
          await refreshUser();
          onPaymentConfirmed();
        }
      } catch (e) {
        console.error('Error checking payment status:', e);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [payment, refreshUser, onPaymentConfirmed]);

  const selectedChainConfig = chains.find(c => c.id === selectedChain);
  const availableTokens = selectedChainConfig?.tokens || ['usdc'];

  const createPayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const paymentInfo = await apiClient.createPayment(selectedChain, selectedToken);
      setPayment(paymentInfo);
      setSupportEmail(paymentInfo.support_email);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create payment');
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!payment) return;

    setCheckingStatus(true);
    setError(null);
    try {
      const result = await apiClient.checkPaymentStatus(payment.payment_id);
      if (result.status === 'confirmed') {
        setPayment({ ...payment, status: 'confirmed' });
        await refreshUser();
        onPaymentConfirmed();
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyToClipboard = (text: string, type: 'address' | 'amount') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const goBackToChainSelection = () => {
    setPayment(null);
    setError(null);
  };

  const switchNetwork = async () => {
    if (!payment || !window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${payment.chain_id.toString(16)}` }],
      });
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        const chainConfig = chains.find(c => c.id === payment.chain);
        if (chainConfig) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${payment.chain_id.toString(16)}`,
                chainName: payment.chain_name,
                rpcUrls: [`https://${payment.chain}.drpc.org`],
                blockExplorerUrls: [payment.explorer],
              }],
            });
          } catch (addError) {
            console.error('Failed to add network:', addError);
          }
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-28 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="relative p-4 border-b border-slate-700 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upgrade to Pro</h2>
              <p className="text-slate-400 text-sm">Pay with USDC or USDT</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p>{error}</p>
                {error.includes('Contact support') && (
                  <a href={`mailto:${supportEmail}`} className="text-red-300 underline mt-1 inline-block">
                    {supportEmail}
                  </a>
                )}
              </div>
            </div>
          )}

          {!payment ? (
            // Chain and token selection
            <div className="space-y-4">
              {/* Chain selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Network
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {chains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        setSelectedChain(chain.id);
                        // Reset token if not available on new chain
                        if (!chain.tokens.includes(selectedToken)) {
                          setSelectedToken(chain.tokens[0]);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedChain === chain.id
                          ? 'border-sc2-blue bg-sc2-blue/10 text-white'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium">{chain.name}</div>
                      <div className="text-xs opacity-70 flex items-center gap-1">
                        <Fuel className="w-3 h-3" />
                        ~${chain.gas_estimate.estimated_cost_usd.toFixed(4)} gas
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Token selection */}
              {availableTokens.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Token
                  </label>
                  <div className="flex gap-2">
                    {availableTokens.map((token) => (
                      <button
                        key={token}
                        onClick={() => setSelectedToken(token)}
                        className={`flex-1 p-3 rounded-lg border font-medium uppercase transition-colors ${
                          selectedToken === token
                            ? 'border-sc2-blue bg-sc2-blue/10 text-white'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price display */}
              <div className="p-3 bg-slate-800 rounded-lg">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    {priceUsd !== null ? `$${priceUsd}` : '...'}
                  </span>
                  <span className="text-slate-400 uppercase">{selectedToken}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">One-time payment, lifetime access</p>
                {selectedChainConfig && (
                  <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                    <Fuel className="w-3 h-3" />
                    Estimated gas: ~${selectedChainConfig.gas_estimate.estimated_cost_usd.toFixed(4)}
                  </p>
                )}
              </div>

              <button
                onClick={createPayment}
                disabled={isLoading || !selectedChain}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating payment...
                  </>
                ) : (
                  'Generate Payment Address'
                )}
              </button>
            </div>
          ) : payment.status === 'confirmed' ? (
            // Payment confirmed
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Payment Confirmed!</h3>
              <p className="text-slate-400 mb-4">You now have Pro access with unlimited uploads.</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-sc2-blue text-white rounded-lg hover:opacity-90"
              >
                Get Started
              </button>
            </div>
          ) : (
            // Payment pending - show address and QR
            <div className="space-y-3">
              {/* Back button */}
              <button
                onClick={goBackToChainSelection}
                className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
              >
                ← Change network/token
              </button>

              {/* Exact Amount Warning */}
              <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg">
                <p className="text-amber-200 font-medium text-center">
                  Send exactly{' '}
                  <span className="text-amber-400 font-bold text-lg">
                    {(payment.amount_raw / 1_000_000).toFixed(3)}
                  </span>{' '}
                  {payment.token.toUpperCase()} on {payment.chain_name}
                </p>
                <p className="text-xs text-amber-300/80 mt-1 text-center">
                  ⚠️ Wrong amounts won't be matched automatically and you'll need to contact support!
                </p>
              </div>

              {/* QR Code - more compact */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3" />
                  {showQR ? 'Hide' : 'Show'} QR
                </button>
                {showQR && (
                  <div className="p-3 bg-white rounded-lg">
                    <QRCodeSVG
                      value={payment.qr_uri}
                      size={140}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                )}
              </div>

              {/* Network switch button */}
              {typeof window !== 'undefined' && window.ethereum && (
                <button
                  onClick={switchNetwork}
                  className="w-full py-2 px-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-xs flex items-center justify-center gap-2"
                >
                  Switch wallet to {payment.chain_name}
                </button>
              )}

              {/* Payment address */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Address
                </label>
                <div className="flex items-center gap-1">
                  <code className="flex-1 p-2 bg-slate-800 rounded-lg text-xs text-white font-mono break-all">
                    {payment.address}
                  </code>
                  <button
                    onClick={() => copyToClipboard(payment.address, 'address')}
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                    title="Copy address"
                  >
                    {copied === 'address' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Amount - Highlighted for exact payment */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Exact Amount ({payment.token.toUpperCase()})
                </label>
                <div className="flex items-center gap-1">
                  <code className="flex-1 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-lg text-amber-400 font-bold font-mono text-center">
                    {(payment.amount_raw / 1_000_000).toFixed(3)}
                  </code>
                  <button
                    onClick={() => copyToClipboard((payment.amount_raw / 1_000_000).toFixed(3), 'amount')}
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                    title="Copy amount"
                  >
                    {copied === 'amount' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Network info - inline */}
              <div className="flex gap-2 text-xs justify-center">
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">{payment.chain_name}</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">{payment.token.toUpperCase()}</span>
              </div>

              {/* View on explorer */}
              <a
                href={`${payment.explorer}/address/${payment.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-xs text-sc2-blue hover:underline"
              >
                View on explorer
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Check status button */}
              <button
                onClick={checkStatus}
                disabled={checkingStatus}
                className="w-full py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {checkingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Check Payment Status'
                )}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Auto-detects every 10s. Expires in 24h.
              </p>

              {/* Support email */}
              <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1 pt-2 border-t border-slate-800">
                <Mail className="w-3 h-3" />
                Issues?{' '}
                <a href={`mailto:${supportEmail}`} className="text-sc2-blue hover:underline">
                  {supportEmail}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
