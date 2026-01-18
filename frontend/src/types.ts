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
  value: number;
  value2?: number;
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
