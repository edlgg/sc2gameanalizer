import React, { useState } from 'react';
import { analyzeReplay, AnalysisResult } from './api/client';
import { TimelineChart } from './components/TimelineChart';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzeReplay(file);
      setResult(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">SC2 Replay Analyzer</h1>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Upload Replay</h2>
          <input
            type="file"
            accept=".SC2Replay"
            onChange={handleFileChange}
            className="mb-4"
          />
          <button
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            className="bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Replay'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Analysis Results</h2>

            {/* Game Info */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">Game Info</h3>
              <p>{result.game_metadata.player_name} ({result.game_metadata.player_race}) vs {result.game_metadata.opponent_name} ({result.game_metadata.opponent_race})</p>
              <p>Matchup: {result.game_metadata.matchup}</p>
              <p>Map: {result.game_metadata.map_name}</p>
            </div>

            {/* Timeline Charts */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-4">Performance Comparison</h3>

              <TimelineChart
                userSnapshots={result.user_snapshots}
                proSnapshots={result.pro_snapshots}
                metric="worker_count"
                title="Worker Count Over Time"
              />

              <TimelineChart
                userSnapshots={result.user_snapshots}
                proSnapshots={result.pro_snapshots}
                metric="army_value"
                title="Army Value Over Time"
              />
            </div>

            {/* Recommendations */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">Top Recommendations</h3>
              <ul className="list-disc list-inside">
                {result.recommendations.slice(0, 5).map((rec, i) => (
                  <li key={i} className={`mb-2 ${rec.priority === 'high' ? 'text-red-600' : 'text-orange-600'}`}>
                    {rec.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Gaps */}
            <div>
              <h3 className="text-xl font-semibold mb-2">Detected Gaps</h3>
              <p>{result.gaps.length} gaps found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
