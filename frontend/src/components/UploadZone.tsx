import { useCallback, useState } from 'react';
import { Upload, Loader2, CheckCircle, XCircle, LogIn, AlertTriangle } from 'lucide-react';
import { useUploadReplay } from '../hooks/useGames';
import { useAuth } from '../contexts/AuthContext';

interface UploadZoneProps {
  onUploadSuccess: (gameId: number) => void;
  onUploadLimitReached?: (uploadsUsed: number, uploadsLimit: number) => void;
  onAuthRequired?: () => void;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  gameId?: number;
  error?: string;
}

export default function UploadZone({ onUploadSuccess, onUploadLimitReached, onAuthRequired }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<FileUploadStatus[]>([]);
  const uploadMutation = useUploadReplay();
  const { isAuthenticated, user } = useAuth();

  const handleFiles = useCallback(
    async (files: File[]) => {
      // Check authentication first
      if (!isAuthenticated) {
        onAuthRequired?.();
        return;
      }

      const replayFiles = files.filter(file => file.name.endsWith('.SC2Replay'));

      if (replayFiles.length === 0) return;

      // Initialize upload queue
      const queue: FileUploadStatus[] = replayFiles.map(file => ({
        file,
        status: 'pending' as const,
      }));
      setUploadQueue(queue);

      // Upload files sequentially
      const uploadedGameIds: number[] = [];
      for (let i = 0; i < replayFiles.length; i++) {
        const file = replayFiles[i];

        // Update status to uploading
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'uploading' as const } : item
        ));

        try {
          const result = await uploadMutation.mutateAsync(file);
          uploadedGameIds.push(result.game.id);

          // Update status to success
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'success' as const, gameId: result.game.id } : item
          ));
        } catch (error: any) {
          // Check if it's an upload limit error
          if (error.uploadLimitReached) {
            onUploadLimitReached?.(error.uploads_used, error.uploads_limit);
            // Mark remaining files as cancelled
            setUploadQueue(prev => prev.map((item, idx) =>
              idx >= i ? {
                ...item,
                status: 'error' as const,
                error: idx === i ? 'Upload limit reached' : 'Cancelled'
              } : item
            ));
            break; // Stop processing more files
          }

          // Update status to error
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i ? {
              ...item,
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Upload failed'
            } : item
          ));
        }
      }

      // After all uploads complete, navigate to the first successful one
      if (uploadedGameIds.length > 0) {
        setTimeout(() => {
          onUploadSuccess(uploadedGameIds[0]);
        }, 1000);
      }
    },
    [uploadMutation, onUploadSuccess, isAuthenticated, onAuthRequired, onUploadLimitReached]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        handleFiles(files);
      }
      // Reset input so same files can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  const isUploading = uploadQueue.some(item => item.status === 'uploading' || item.status === 'pending');
  const allComplete = uploadQueue.length > 0 && uploadQueue.every(item => item.status === 'success' || item.status === 'error');
  const successCount = uploadQueue.filter(item => item.status === 'success').length;

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card animate-slide-up">
          <h2 className="text-2xl font-bold mb-6">Upload Replays</h2>

          <div className="border-2 border-dashed border-slate-700 rounded-lg p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                <LogIn className="w-8 h-8 text-slate-500" />
              </div>
              <div>
                <p className="text-lg font-medium mb-2">
                  Sign in to upload replays
                </p>
                <p className="text-sm text-slate-400 mb-4">
                  Create a free account to get started with 3 uploads per month
                </p>
                <button
                  onClick={onAuthRequired}
                  className="btn-primary"
                >
                  Sign In / Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show upload limit warning if close to limit
  const showLimitWarning = user && user.subscription_tier === 'free' && user.uploads_limit > 0 && user.uploads_used >= user.uploads_limit - 1;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Upload Replays</h2>
          {user && user.subscription_tier === 'free' && (
            <div className="text-sm text-slate-400">
              {user.uploads_limit - user.uploads_used} uploads remaining this month
            </div>
          )}
        </div>

        {showLimitWarning && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="text-amber-200 font-medium">
                {user.uploads_used >= user.uploads_limit
                  ? 'Monthly upload limit reached!'
                  : 'Last free upload this month!'}
              </span>
              <span className="text-amber-200/70 ml-1">
                Upgrade to Pro for unlimited uploads.
              </span>
            </div>
          </div>
        )}

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
            ${isUploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          {uploadQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-16 h-16 text-slate-600" />
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop your .SC2Replay files here
                </p>
                <p className="text-sm text-slate-400 mb-4">or</p>
                <label className="btn-primary cursor-pointer inline-block">
                  Browse Files
                  <input
                    type="file"
                    accept=".SC2Replay"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="mt-4 text-sm text-slate-500 space-y-1">
                <p>✓ Select multiple files at once</p>
                <p>✓ Must be 1v1 games</p>
                <p>✓ Must be longer than 60 seconds</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Uploading {uploadQueue.length} {uploadQueue.length === 1 ? 'replay' : 'replays'}
                </h3>
                {allComplete && (
                  <button
                    onClick={() => setUploadQueue([])}
                    className="btn-secondary text-sm"
                  >
                    Upload More
                  </button>
                )}
              </div>

              {uploadQueue.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  {item.status === 'pending' && (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    </div>
                  )}
                  {item.status === 'uploading' && (
                    <Loader2 className="w-8 h-8 text-sc2-blue animate-spin" />
                  )}
                  {item.status === 'success' && (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  )}
                  {item.status === 'error' && (
                    <XCircle className="w-8 h-8 text-red-500" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.file.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.status === 'pending' && 'Waiting...'}
                      {item.status === 'uploading' && 'Parsing replay...'}
                      {item.status === 'success' && 'Upload successful!'}
                      {item.status === 'error' && (item.error || 'Upload failed')}
                    </p>
                  </div>

                  <div className="text-xs text-slate-500">
                    {(item.file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ))}

              {allComplete && successCount > 0 && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                  <p className="text-green-500 font-medium">
                    {successCount} {successCount === 1 ? 'replay' : 'replays'} uploaded successfully!
                  </p>
                  <p className="text-sm text-slate-400 mt-1">Redirecting to first game...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
