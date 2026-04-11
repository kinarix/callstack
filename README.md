# CALLSTACK - Progressive Web App

A brutalist-design API testing tool that works offline, stores requests locally in SQLite, and supports Google Sign-In for multi-device sync.

## 🚀 Features

- **Full REST API Testing**: Support for GET, POST, PUT, DELETE, PATCH methods
- **Local SQLite Storage**: All requests stored in browser using SQL.js (no backend needed)
- **Google Sign-In**: Optional authentication for user-specific request collections
- **Offline-First PWA**: Works completely offline once installed
- **Request Builder**: 
  - URL parameters management
  - Custom headers
  - Request body editor (JSON, text, etc.)
- **Response Viewer**: 
  - Status codes with color coding
  - Response time tracking
  - Response size calculation
  - Formatted JSON display
- **Collection Management**: Save, organize, and reuse requests
- **Auto-save**: All changes saved automatically
- **Brutalist Design**: Dark mode, monospace typography, geometric precision

## 📋 Prerequisites

- Modern web browser (Chrome, Edge, Firefox, Safari)
- HTTPS hosting (required for PWA and Google Sign-In)
- Google Cloud Project (for Google Sign-In - optional)

## 🔧 Setup Instructions

### 1. Google Sign-In Setup (Optional)

If you want to enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Google+ API"
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen
6. Add authorized JavaScript origins:
   - `https://yourdomain.com`
   - `http://localhost:8000` (for local testing)
7. Copy your **Client ID**
8. In `callstack.html`, replace:
   ```javascript
   const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
   ```

### 2. Generate PWA Icons

You'll need to create app icons. Use any icon generator or create manually:

**Required sizes:**
- `icon-192.png` (192×192 pixels)
- `icon-512.png` (512×512 pixels)

**Design suggestion**: 
- Black background (#0a0a0a)
- Neon green accent (#00ff88)
- Geometric/monospace aesthetic
- Text: "API" or abstract geometric shape

**Quick generation options:**
- [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- Or design in Figma/Photoshop

### 3. Local Testing

Using Python:
```bash
# Python 3
python -m http.server 8000

# Visit: http://localhost:8000/callstack.html
```

Using Node.js:
```bash
npx http-server -p 8000

# Visit: http://localhost:8000/callstack.html
```

### 4. Production Deployment

#### Option A: GitHub Pages

1. Create a new repository
2. Upload all files:
   - `callstack.html`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
3. Go to Settings → Pages
4. Select branch: `main`, folder: `/ (root)`
5. Your app will be at: `https://username.github.io/repo-name/callstack.html`

#### Option B: Netlify

1. Create account at [Netlify](https://www.netlify.com/)
2. Drag and drop all files
3. Site is live instantly with HTTPS

#### Option C: Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts

#### Option D: Self-Hosted

Requirements:
- HTTPS (use Let's Encrypt with Certbot)
- Web server (Nginx, Apache, Caddy)

**Nginx configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name callstack.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    root /var/www/callstack;
    index callstack.html;
    
    location / {
        try_files $uri $uri/ /callstack.html;
    }
    
    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}
```

### 5. Install as PWA

Once deployed on HTTPS:

**Desktop (Chrome/Edge):**
1. Visit the site
2. Click the install icon in the address bar
3. Click "Install"

**Mobile (Android):**
1. Visit the site
2. Tap menu (⋮)
3. Tap "Add to Home Screen"

**Mobile (iOS):**
1. Visit the site in Safari
2. Tap the share button
3. Tap "Add to Home Screen"

## 🎯 Usage Guide

### Creating a Request

1. Click the **+** button in the sidebar
2. Name your request
3. Select HTTP method (GET, POST, PUT, DELETE, PATCH)
4. Enter the URL
5. Add parameters, headers, or body as needed
6. Click **SEND**

### Managing Parameters

- Click **Params** tab
- Click **+ Add Parameter**
- Enter key-value pairs
- Parameters are automatically added to URL

### Adding Headers

- Click **Headers** tab
- Click **+ Add Header**
- Common examples:
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_TOKEN`
  - `Accept: application/json`

### Request Body

- Click **Body** tab
- Enter raw JSON, XML, or text
- Example JSON:
  ```json
  {
    "username": "test",
    "password": "secret123"
  }
  ```

### Viewing Responses

After sending, you'll see:
- **Status**: HTTP status code (200, 404, 500, etc.)
- **Time**: Response time in milliseconds
- **Size**: Response size in KB
- **Body**: Formatted response (JSON auto-formatted)

## 💾 Data Storage

### Local Storage

All data is stored in your browser using:
- **SQL.js**: In-memory SQLite database
- **localStorage**: Persisted database export

**Database Schema:**

```sql
-- Requests table
CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT,
  name TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  params TEXT,
  headers TEXT,
  body TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Responses table (history)
CREATE TABLE responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER,
  status INTEGER,
  status_text TEXT,
  headers TEXT,
  body TEXT,
  time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id)
);
```

### Data Export/Backup

To backup your data:

1. Open browser DevTools (F12)
2. Go to Console
3. Run:
   ```javascript
   const data = localStorage.getItem('api_tester_db');
   const blob = new Blob([data], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = 'callstack-backup.json';
   a.click();
   ```

To restore:
```javascript
// Paste your backup JSON string
const backupData = 'YOUR_BACKUP_DATA_HERE';
localStorage.setItem('api_tester_db', backupData);
location.reload();
```

## 🔒 Security & Privacy

- **All data stored locally**: Nothing sent to external servers
- **HTTPS required**: For PWA installation and Google Sign-In
- **CORS handling**: May encounter CORS errors for some APIs (same as Postman)
- **No telemetry**: Zero tracking or analytics
- **Google Sign-In**: Only stores email, name, and profile picture locally

### CORS Workarounds

If you encounter CORS errors:

1. **Use a CORS proxy** (development only):
   - `https://cors-anywhere.herokuapp.com/https://api.example.com`
   - Note: Public proxies are unreliable

2. **Configure API server**: Add CORS headers
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
   Access-Control-Allow-Headers: Content-Type, Authorization
   ```

3. **Use browser extension**: 
   - Chrome: "CORS Unblock"
   - Firefox: "CORS Everywhere"

## 🎨 Customization

### Color Scheme

Edit CSS variables in `callstack.html`:

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #161616;
  --bg-tertiary: #1f1f1f;
  --border: #2a2a2a;
  --text-primary: #e0e0e0;
  --accent-get: #00ff88;
  --accent-post: #00b8ff;
  --accent-put: #ffaa00;
  --accent-delete: #ff3366;
  --accent-patch: #cc66ff;
}
```

### Fonts

Replace Google Fonts link:
```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap" rel="stylesheet">
```

Update CSS:
```css
body {
  font-family: 'YOUR_FONT', monospace;
}
```

## 🐛 Troubleshooting

### PWA Not Installing
- Ensure you're on HTTPS
- Check browser console for errors
- Verify `manifest.json` is accessible
- Try hard refresh (Ctrl+Shift+R)

### Google Sign-In Not Working
- Check Client ID is correct
- Verify authorized origins in Google Console
- Must be on HTTPS or localhost
- Check browser console for errors

### Database Not Persisting
- Check localStorage is enabled
- Browser may be in private/incognito mode
- Storage quota may be exceeded
- Try clearing other site data

### Request Failing
- Check network connection
- Verify URL is correct
- Check for CORS issues (see Security section)
- Open DevTools Network tab for details

## 📱 Browser Support

| Browser | Version | PWA Install | Google Sign-In | Offline |
|---------|---------|-------------|----------------|---------|
| Chrome  | 67+     | ✅          | ✅             | ✅      |
| Edge    | 79+     | ✅          | ✅             | ✅      |
| Firefox | 60+     | ⚠️*         | ✅             | ✅      |
| Safari  | 11.1+   | ✅          | ✅             | ✅      |
| Opera   | 54+     | ✅          | ✅             | ✅      |

*Firefox supports PWAs but doesn't show install prompts as prominently

## 🚧 Limitations

- **CORS restrictions**: Same as browser-based tools (unlike Postman desktop)
- **Large responses**: May be slow for >10MB responses
- **File uploads**: Not currently supported
- **WebSocket testing**: Not supported
- **Certificate handling**: Uses browser's certificate store

## 🔄 Updates & Versions

When you update the PWA:

1. Increment cache version in `sw.js`:
   ```javascript
   const CACHE_NAME = 'callstack-v2'; // Update version
   ```

2. Users will see "Update available" message
3. Refresh to get new version

## 📄 License

MIT License - Use freely for personal or commercial projects

## 🤝 Contributing

This is a single-file PWA for easy deployment. To contribute:

1. Fork the repository
2. Make changes to `callstack.html`
3. Test locally
4. Submit pull request

## 💡 Tips & Tricks

### Environment Variables

Create different environments:
1. Duplicate a request
2. Name them: "API - Dev", "API - Prod"
3. Update URLs accordingly

### Quick Testing

Use keyboard shortcuts:
- `Ctrl/Cmd + Enter`: Send request (when URL input focused)
- `Ctrl/Cmd + N`: New request
- `Ctrl/Cmd + /`: Focus search (future feature)

### Organize Requests

Name requests descriptively:
- ✅ `Auth - Login`
- ✅ `Users - Get All`
- ✅ `Products - Create`
- ❌ `Request 1`

### Response History

All responses are saved in the database. Future version will show history per request.

---

**Built with**: Pure JavaScript, SQL.js, Google Sign-In API, Service Workers

**No dependencies**: Everything runs in the browser, no build step required

**Offline-first**: Works without internet after first load
