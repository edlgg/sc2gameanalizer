export interface GameMetadata {
  player_name: string;
  player_race: string;
  opponent_name: string;
  opponent_race: string;
  matchup: string;
  game_length: number;
  map_name?: string;
  game_date?: string;
  result?: string;
}

export interface Snapshot {
  game_time: number;
  worker_count: number;
  army_value: number;
  army_supply: number;
  bases_count: number;
}

export interface Gap {
  metric: string;
  timestamp: number;
  user_value: number;
  pro_value: number;
  difference: number;
  severity: string;
}

export interface Recommendation {
  metric: string;
  timestamp: number;
  text: string;
  priority: string;
}

export interface AnalysisResult {
  game_metadata: GameMetadata;
  similar_pro_games: number[];
  gaps: Gap[];
  recommendations: Recommendation[];
  user_snapshots: Snapshot[];
  pro_snapshots: Snapshot[];
}

export async function analyzeReplay(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('replay', file);

  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}

export async function getProGames(): Promise<any> {
  const response = await fetch('/api/pro-games');
  return response.json();
}
