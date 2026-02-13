/**
 * React Query hooks for data fetching
 */
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// Get all games
export function useGames(filters?: { is_pro?: boolean; map_name?: string; race?: string }) {
  return useQuery({
    queryKey: ['games', filters],
    queryFn: () => apiClient.getGames(filters),
  });
}

// Get single game (replay data is immutable once parsed)
export function useGame(gameId: number | null) {
  return useQuery({
    queryKey: ['game', gameId],
    queryFn: () => apiClient.getGame(gameId!),
    enabled: gameId !== null,
    staleTime: Infinity,
  });
}

// Get snapshots (replay snapshots never change)
export function useSnapshots(gameId: number | null, playerNumber?: 1 | 2) {
  return useQuery({
    queryKey: ['snapshots', gameId, playerNumber],
    queryFn: () => apiClient.getSnapshots(gameId!, playerNumber),
    enabled: gameId !== null,
    staleTime: Infinity,
  });
}

// Get similar games (deterministic for same inputs)
export function useSimilarGames(gameId: number | null, limit: number = 3) {
  return useQuery({
    queryKey: ['similar', gameId, limit],
    queryFn: () => apiClient.getSimilarGames(gameId!, limit),
    enabled: gameId !== null,
    staleTime: Infinity,
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

// Fetch snapshots for multiple games in parallel with race matching
export function useMultipleProSnapshots(gameIds: number[], userGameId: number, userPlayerNumber: 1 | 2) {
  return useQueries({
    queries: gameIds.map(id => ({
      queryKey: ['snapshots-race-matched', id, userGameId, userPlayerNumber],
      queryFn: () => apiClient.getSnapshotsRaceMatched(id, userGameId, userPlayerNumber),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })),
  });
}

// Get build order events
export function useBuildOrder(
  gameId: number | null,
  playerNumber?: 1 | 2,
  milestonesOnly: boolean = false
) {
  return useQuery({
    queryKey: ['buildOrder', gameId, playerNumber, milestonesOnly],
    queryFn: () => apiClient.getBuildOrder(gameId!, playerNumber, milestonesOnly),
    enabled: gameId !== null,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Compare build orders
export function useBuildOrderComparison(
  gameId: number | null,
  proGameIds: number[],
  playerNumber: 1 | 2 = 1
) {
  return useQuery({
    queryKey: ['buildOrderComparison', gameId, proGameIds, playerNumber],
    queryFn: () => apiClient.compareBuildOrders(gameId!, proGameIds, playerNumber),
    enabled: gameId !== null && proGameIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Delete game mutation
export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameId: number) => apiClient.deleteGame(gameId),
    onSuccess: () => {
      // Invalidate games query to refetch
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });
}

// Delete all games mutation
export function useDeleteAllGames() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keepProReplays: boolean = true) => apiClient.deleteAllGames(keepProReplays),
    onSuccess: () => {
      // Invalidate games query to refetch
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });
}
