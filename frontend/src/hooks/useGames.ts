/**
 * React Query hooks for data fetching
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// Get all games
export function useGames(filters?: { is_pro?: boolean; map_name?: string; race?: string }) {
  return useQuery({
    queryKey: ['games', filters],
    queryFn: () => apiClient.getGames(filters),
  });
}

// Get single game
export function useGame(gameId: number | null) {
  return useQuery({
    queryKey: ['game', gameId],
    queryFn: () => apiClient.getGame(gameId!),
    enabled: gameId !== null,
  });
}

// Get snapshots
export function useSnapshots(gameId: number | null, playerNumber?: 1 | 2) {
  return useQuery({
    queryKey: ['snapshots', gameId, playerNumber],
    queryFn: () => apiClient.getSnapshots(gameId!, playerNumber),
    enabled: gameId !== null,
  });
}

// Get similar games
export function useSimilarGames(gameId: number | null, limit: number = 3) {
  return useQuery({
    queryKey: ['similar', gameId, limit],
    queryFn: () => apiClient.getSimilarGames(gameId!, limit),
    enabled: gameId !== null,
  });
}

// Compare games
export function useCompareGames(gameId1: number | null, gameId2: number | null) {
  return useQuery({
    queryKey: ['compare', gameId1, gameId2],
    queryFn: () => apiClient.compareGames(gameId1!, gameId2!),
    enabled: gameId1 !== null && gameId2 !== null,
  });
}

// Upload replay mutation
export function useUploadReplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => apiClient.uploadReplay(file),
    onSuccess: () => {
      // Invalidate games query to refetch
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });
}
