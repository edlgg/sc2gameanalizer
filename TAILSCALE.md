# Using SC2 Replay Analyzer with Tailscale

## Setup

The app now automatically detects when it's running through Tailscale proxy and uses the correct API endpoints.

### 1. Start Both Servers

You need both backend and frontend running:

```bash
# Terminal 1: Backend on port 8000
cd /home/kit/Documents/repos/sc2gameanalizer
PYTHONPATH=. .venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend on port 5173
cd /home/kit/Documents/repos/sc2gameanalizer/frontend
npm run dev -- --host
```

### 2. Access Through Tailscale

Access the app at:
```
https://kit.tail993c4d.ts.net/proxy/5173/
```

The backend should be accessible at:
```
https://kit.tail993c4d.ts.net/proxy/8000/
```

### 3. Verify It's Working

Open the browser console (F12) and look for:
```
🔗 SC2 Analyzer API Base URL: https://kit.tail993c4d.ts.net/proxy/8000
```

This confirms the app detected Tailscale and is using the correct backend URL.

### 4. Test the API

You can test the backend directly:
```bash
curl https://kit.tail993c4d.ts.net/proxy/8000/
# Should return: {"status":"ok","message":"SC2 Replay Analyzer API"}

curl https://kit.tail993c4d.ts.net/proxy/8000/api/games
# Should return: {"games":[]}
```

## Troubleshooting

### Issue: 404 errors in console

**Check:**
1. Is the backend running on port 8000?
   ```bash
   curl http://localhost:8000/
   ```

2. Is the backend accessible through Tailscale?
   ```bash
   curl https://kit.tail993c4d.ts.net/proxy/8000/
   ```

3. Check the browser console for the API base URL log message

### Issue: CORS errors

The backend is configured to accept requests from `*.ts.net` domains. If you see CORS errors, check:

1. Backend logs for CORS-related messages:
   ```bash
   tail -f backend.log
   ```

2. Make sure the backend CORS settings include your Tailscale domain

### Issue: Code-server login page

If you see a code-server login page instead of the app, you're accessing the wrong port or path. Make sure you're using:
- `/proxy/5173/` for the frontend
- `/proxy/8000/` for the backend

## How It Works

The app uses smart URL detection:

1. **Localhost**: Uses Vite dev server proxy (`/api/*` → `http://localhost:8000/api/*`)
2. **Tailscale**: Detects `.ts.net` domain and automatically uses `https://kit.tail993c4d.ts.net/proxy/8000`
3. **Custom**: Set `VITE_API_URL` environment variable to override

## Production Deployment

For production (not using Vite dev server), set the backend URL:

```bash
# In frontend/.env.production
VITE_API_URL=https://your-backend-url.com
```

Then build:
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`.
