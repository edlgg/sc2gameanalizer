/**
 * API client for backend communication
 */
import type { Game, Snapshot, SimilarGame, ComparisonData, BuildOrderEvent, BuildOrderAnalysis, AuthResponse, User, UploadResponse } from '../types';

// Token storage keys
const TOKEN_KEY = 'sc2_auth_token';
const USER_KEY = 'sc2_auth_user';

// Detect if we're running through Tailscale proxy
const getApiBaseUrl = () => {
  // Check for explicit env variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // If we're on Tailscale (.ts.net domain with /proxy/ path)
  if (window.location.hostname.endsWith('.ts.net') && window.location.pathname.startsWith('/proxy/')) {
    // Extract the base Tailscale URL and add backend proxy path
    const origin = window.location.origin;
    return `${origin}/proxy/8000`;
  }

  // Default: use Vite dev server proxy (relative URLs)
  return '';
};

const API_BASE_URL = getApiBaseUrl();

// Log API base URL for debugging
console.log('🔗 SC2 Analyzer API Base URL:', API_BASE_URL || '(using relative URLs with proxy)');

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Token management
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getStoredUser(): User | null {
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }

  setStoredUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      // Check if it's an upload limit error
      if (error.detail?.error === 'upload_limit_reached') {
        const limitError = new Error(error.detail.message) as Error & { uploadLimitReached: true; uploads_used: number; uploads_limit: number };
        limitError.uploadLimitReached = true;
        limitError.uploads_used = error.detail.uploads_used;
        limitError.uploads_limit = error.detail.uploads_limit;
        throw limitError;
      }
      throw new Error(typeof error.detail === 'string' ? error.detail : error.detail?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.access_token);
    this.setStoredUser(response.user);
    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.access_token);
    this.setStoredUser(response.user);
    return response;
  }

  async getMe(): Promise<User> {
    const user = await this.request<User>('/api/auth/me');
    this.setStoredUser(user);
    return user;
  }

  logout(): void {
    this.clearToken();
  }

  // Upload replay (now requires auth)
  async uploadReplay(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      // Check if it's an upload limit error
      if (error.detail?.error === 'upload_limit_reached') {
        const limitError = new Error(error.detail.message) as Error & { uploadLimitReached: true; uploads_used: number; uploads_limit: number };
        limitError.uploadLimitReached = true;
        limitError.uploads_used = error.detail.uploads_used;
        limitError.uploads_limit = error.detail.uploads_limit;
        throw limitError;
      }
      throw new Error(typeof error.detail === 'string' ? error.detail : error.detail?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get all games
  async getGames(filters?: {
    is_pro?: boolean;
    map_name?: string;
    race?: string;
  }): Promise<Game[]> {
    const params = new URLSearchParams();
    if (filters?.is_pro !== undefined) params.append('is_pro', String(filters.is_pro));
    if (filters?.map_name) params.append('map_name', filters.map_name);
    if (filters?.race) params.append('race', filters.race);

    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request<{ games: Game[] }>(`/api/games${query}`);
    return data.games;
  }

  // Get single game
  async getGame(gameId: number): Promise<Game> {
    return this.request<Game>(`/api/games/${gameId}`);
  }

  // Get snapshots for a game
  async getSnapshots(gameId: number, playerNumber?: 1 | 2): Promise<Snapshot[]> {
    const query = playerNumber ? `?player_number=${playerNumber}` : '';
    const data = await this.request<{ snapshots: Snapshot[] }>(
      `/api/games/${gameId}/snapshots${query}`
    );
    return data.snapshots;
  }

  // Get snapshots with race matching
  async getSnapshotsRaceMatched(
    gameId: number,
    userGameId: number,
    userPlayerNumber: 1 | 2
  ): Promise<Snapshot[]> {
    const params = new URLSearchParams({
      user_game_id: String(userGameId),
      user_player_number: String(userPlayerNumber),
    });

    const data = await this.request<{ snapshots: Snapshot[] }>(
      `/api/games/${gameId}/snapshots-race-matched?${params.toString()}`
    );
    return data.snapshots;
  }

  // Get similar games
  async getSimilarGames(gameId: number, limit: number = 3): Promise<SimilarGame[]> {
    const data = await this.request<{ similar_games: SimilarGame[] }>(
      `/api/games/${gameId}/similar?limit=${limit}`
    );
    return data.similar_games;
  }

  // Compare two games
  async compareGames(gameId1: number, gameId2: number): Promise<ComparisonData> {
    return this.request<ComparisonData>(`/api/compare/${gameId1}/${gameId2}`);
  }

  // Get build order events
  async getBuildOrder(
    gameId: number,
    playerNumber?: 1 | 2,
    milestonesOnly: boolean = false
  ): Promise<BuildOrderEvent[]> {
    const params = new URLSearchParams();
    if (playerNumber) params.append('player_number', String(playerNumber));
    if (milestonesOnly) params.append('milestones_only', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request<{ events: BuildOrderEvent[] }>(
      `/api/games/${gameId}/build-order${query}`
    );
    return data.events;
  }

  // Compare build orders
  async compareBuildOrders(
    gameId: number,
    proGameIds: number[],
    playerNumber: 1 | 2 = 1
  ): Promise<{ user_events: BuildOrderEvent[]; pro_events_count: number; analysis: BuildOrderAnalysis }> {
    const params = new URLSearchParams({
      pro_game_ids: proGameIds.join(','),
      player_number: String(playerNumber),
    });

    return this.request<{ user_events: BuildOrderEvent[]; pro_events_count: number; analysis: BuildOrderAnalysis }>(
      `/api/games/${gameId}/build-order-comparison?${params.toString()}`
    );
  }

  // Delete a single game
  async deleteGame(gameId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/api/games/${gameId}`,
      { method: 'DELETE' }
    );
  }

  // Delete all games (optionally keep pro replays)
  async deleteAllGames(keepProReplays: boolean = true): Promise<{ success: boolean; message: string; deleted_count: number }> {
    const params = new URLSearchParams({ keep_pro_replays: String(keepProReplays) });
    return this.request<{ success: boolean; message: string; deleted_count: number }>(
      `/api/games?${params.toString()}`,
      { method: 'DELETE' }
    );
  }

  // Crypto payments
  async getSupportedChains(): Promise<{
    chains: Array<{
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
    }>;
    support_email: string;
    price_usd: number;
  }> {
    return this.request('/api/payment/chains');
  }

  async createPayment(chain: string = 'polygon', token: string = 'usdc'): Promise<{
    payment_id: number;
    address: string;
    amount: string;
    amount_raw: number;
    amount_exact: number;  // Float for display (e.g., 29.991)
    token: string;
    chain: string;
    chain_id: number;
    chain_name: string;
    token_contract: string;
    explorer: string;
    expires_at: string;
    status: string;
    qr_uri: string;
    support_email: string;
  }> {
    return this.request('/api/payment/create', {
      method: 'POST',
      body: JSON.stringify({ chain, token }),
    });
  }

  async checkPaymentStatus(paymentId: number): Promise<{
    status: 'pending' | 'confirmed';
    message: string;
    user?: User;
    support_email?: string;
  }> {
    return this.request(`/api/payment/status/${paymentId}`);
  }

  async getPendingPayment(): Promise<{
    payment: {
      payment_id: number;
      address: string;
      amount: string;
      amount_raw: number;
      amount_exact: number;  // Float for display (e.g., 29.991)
      token: string;
      chain: string;
      chain_id: number;
      chain_name: string;
      token_contract: string;
      explorer: string;
      expires_at: string;
      status: string;
      qr_uri: string;
    } | null;
    support_email: string;
  }> {
    return this.request('/api/payment/pending');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
