import { useCallback, useState } from 'react';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useUploadReplay } from '../hooks/useGames';

interface UploadZoneProps {
  onUploadSuccess: (gameId: number) => void;
}

export default function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useUploadReplay();

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const result = await uploadMutation.mutateAsync(file);
        onUploadSuccess(result.game.id);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    },
    [uploadMutation, onUploadSuccess]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.SC2Replay')) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card animate-slide-up">
        <h2 className="text-2xl font-bold mb-6">Upload Replay</h2>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-all
            ${isDragging ? 'border-sc2-blue bg-sc2-blue/10' : 'border-slate-700 hover:border-slate-600'}
          `}
        >
          {uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-16 h-16 text-sc2-blue animate-spin" />
              <p className="text-lg font-medium">Parsing replay...</p>
              <p className="text-sm text-slate-400">This may take a few seconds</p>
            </div>
          ) : uploadMutation.isSuccess ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
              <p className="text-lg font-medium text-green-500">Upload successful!</p>
              <p className="text-sm text-slate-400">Redirecting to comparison...</p>
            </div>
          ) : uploadMutation.isError ? (
            <div className="flex flex-col items-center gap-4">
              <XCircle className="w-16 h-16 text-red-500" />
              <p className="text-lg font-medium text-red-500">Upload failed</p>
              <p className="text-sm text-slate-400">
                {uploadMutation.error?.message || 'Unknown error'}
              </p>
              <button
                onClick={() => uploadMutation.reset()}
                className="btn-secondary mt-2"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-16 h-16 text-slate-600" />
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop your .SC2Replay file here
                </p>
                <p className="text-sm text-slate-400 mb-4">or</p>
                <label className="btn-primary cursor-pointer inline-block">
                  Browse Files
                  <input
                    type="file"
                    accept=".SC2Replay"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="mt-4 text-sm text-slate-500 space-y-1">
                <p>✓ Must be a 1v1 game</p>
                <p>✓ Must be longer than 60 seconds</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
