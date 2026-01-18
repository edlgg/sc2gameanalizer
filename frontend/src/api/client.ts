/**
 * API client for backend communication
 */
import type { Game, Snapshot, SimilarGame, ComparisonData } from '../types';

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

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Upload replay
  async uploadReplay(file: File): Promise<{ success: boolean; game: Game }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
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
}

export const apiClient = new ApiClient(API_BASE_URL);
