/**
 * TypeScript types for SC2 Replay Analyzer
 */

export interface Game {
  id: number;
  replay_file: string;
  game_date: string;
  game_length_seconds: number;
  map_name: string;
  player1_name: string;
  player1_race: Race;
  player2_name: string;
  player2_race: Race;
  result: 1 | 2;
  is_pro_replay: boolean;
}

export interface Snapshot {
  id: number;
  game_id: number;
  game_time_seconds: number;
  player_number: 1 | 2;
  race: Race;

  // Economy
  worker_count: number;
  mineral_collection_rate: number;
  gas_collection_rate: number;
  unspent_minerals: number;
  unspent_gas: number;
  total_minerals_collected: number;
  total_gas_collected: number;

  // Army
  army_value_minerals: number;
  army_value_gas: number;
  army_supply: number;
  units: Record<string, number>;

  // Buildings
  buildings: Record<string, number>;
  upgrades: Record<string, number>;

  // Map control
  base_count: number;
  vision_area: number;
  unit_map_presence: Record<string, any>;

  // Combat/Efficiency
  units_killed_value: number;
  units_lost_value: number;
  resources_spent_minerals: number;
  resources_spent_gas: number;
  collection_efficiency: number;
  spending_efficiency: number;
}

export interface SimilarGame extends Game {
  game_id: number; // Backend returns game_id (same as id)
  similarity_score: number;
  length_score: number;
  macro_score: number;
  map_match: boolean;
  matchup: string;
  matched_player_number: number;
  matched_player_name: string;
  matched_player_race: string;
}

export interface ComparisonData {
  game1: Game;
  game2: Game;
  snapshots1: Snapshot[];
  snapshots2: Snapshot[];
}

export type Race = 'Terran' | 'Protoss' | 'Zerg';

export interface ChartDataPoint {
  time: number;
  timeFormatted: string;
  value: number;  // User value
  value2?: number;  // Pro average value (for backward compatibility)
  proAvg?: number;  // Pro average value (explicit)
  proMin?: number;  // Minimum value across selected pro games
  proMax?: number;  // Maximum value across selected pro games
  // Individual pro game values (for low-level comparison)
  proGames?: {
    [gameId: string]: number;
  };
}

export interface KeyMoment {
  time: number;
  title: string;
  description: string;
  userValue: number;
  proValue: number;
  difference: number;
  type: 'workers' | 'army' | 'bases' | 'efficiency';
}

export interface DeltaPoint {
  time: number;
  difference: number;
  percentageDifference: number;
  isAhead: boolean;
}

export interface BuildOrderEvent {
  event_type: 'building' | 'unit' | 'upgrade';
  item_name: string;
  game_time_seconds: number;
  player_number: 1 | 2;
  is_milestone: boolean;
}

export interface BuildOrderComparison {
  event_type: 'building' | 'unit' | 'upgrade';
  item_name: string;
  user_time: number;
  pro_avg_time: number;
  difference: number;
  status: 'early' | 'on-time' | 'late';
}

export interface BuildOrderAnalysis {
  comparisons: BuildOrderComparison[];
  user_missing: Array<{
    event_type: string;
    item_name: string;
    pro_avg_time: number;
  }>;
  user_extra: Array<{
    event_type: string;
    item_name: string;
    user_time: number;
  }>;
}

// Auth types
export interface User {
  id: number;
  email: string;
  subscription_tier: 'free' | 'pro';
  uploads_used: number;
  uploads_limit: number; // -1 means unlimited
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface UploadLimitError {
  error: 'upload_limit_reached';
  message: string;
  uploads_used: number;
  uploads_limit: number;
}

export interface UploadResponse {
  success: boolean;
  game: Game;
  uploads_used?: number;
  uploads_limit?: number;
}
