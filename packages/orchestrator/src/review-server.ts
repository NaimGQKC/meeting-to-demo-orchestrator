import express, { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const REVIEW_DIR = path.resolve(__dirname, '../../../review');
const CONTEXT_DIR = path.resolve(__dirname, '../../.antigravity/context');
const COMMENTS_FILE = path.join(REVIEW_DIR, '.comments.json');

export function setupReviewRoutes(app: express.Application) {
  const router = Router();

  // Body parsing scoped to /review routes only
  router.use(express.json());

  // ──────────────────────────────────────
  // Server-side TSX extraction
  // ──────────────────────────────────────
  function extractTSX(raw: string): string | null {
    // Remove <Thinking>...</Thinking> blocks
    let clean = raw.replace(/<Thinking>[\s\S]*?<\/Thinking>/gi, '');

    // Find fenced code blocks using indexOf (no regex backtick issues)
    const fence = '`' + '`' + '`';
    const tsxBlocks: string[] = [];
    let pos = 0;
    while (true) {
      const start = clean.indexOf(fence, pos);
      if (start === -1) break;
      const lineEnd = clean.indexOf('\n', start);
      if (lineEnd === -1) break;
      const lang = clean.substring(start + 3, lineEnd).trim().toLowerCase();
      const close = clean.indexOf(fence, lineEnd + 1);
      if (close === -1) break;
      if (['', 'tsx', 'jsx', 'typescript', 'javascript'].includes(lang)) {
        tsxBlocks.push(clean.substring(lineEnd + 1, close).trim());
      }
      pos = close + 3;
    }

    if (tsxBlocks.length > 0) {
      return tsxBlocks.find(b => b.includes('export default'))
        || tsxBlocks.sort((a, b) => b.length - a.length)[0];
    }

    // If no fenced blocks, check if the content IS raw TSX
    if (clean.includes('export default') || clean.includes('export function') || clean.includes('import ')) {
      return clean.trim();
    }
    return null;
  }

  // ──────────────────────────────────────
  // Serve the Ampliwork logo
  // ──────────────────────────────────────
  router.get('/logo', (_req: Request, res: Response) => {
    try {
      const files = fs.readdirSync(CONTEXT_DIR);
      const logo = files.find(f =>
        /\.(jpg|jpeg|png|svg|webp)$/i.test(f) &&
        f.toLowerCase().includes('ampli')
      ) || files.find(f => /\.(jpg|jpeg|png|svg|webp)$/i.test(f));

      if (logo) {
        const ext = path.extname(logo).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg',
          png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp'
        };
        const filePath = path.join(CONTEXT_DIR, logo);
        const data = fs.readFileSync(filePath);
        res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
        res.end(data);
      } else {
        res.status(404).json({ error: 'No logo found' });
      }
    } catch (err) {
      console.error('[Review] Logo error:', err);
      res.status(404).json({ error: 'Logo not found' });
    }
  });

  // ──────────────────────────────────────
  // List all prototypes in review/
  // ──────────────────────────────────────
  router.get('/prototypes', (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(REVIEW_DIR)) {
        res.json([]);
        return;
      }
      const files = fs.readdirSync(REVIEW_DIR)
        .filter(f => f.endsWith('.tsx') || f.endsWith('.md'))
        .map(f => {
          const stat = fs.statSync(path.join(REVIEW_DIR, f));
          return {
            name: f,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            isAmpliwork: f.toLowerCase().includes('ampliwork'),
          };
        })
        .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ──────────────────────────────────────
  // Get prototype content
  // ──────────────────────────────────────
  router.get('/prototypes/:filename', (req: Request, res: Response) => {
    try {
      const filename = req.params.filename as string;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }
      const filePath = path.join(REVIEW_DIR, filename);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const tsxCode = extractTSX(content);
      res.json({ filename, content, tsxCode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ──────────────────────────────────────
  // Comments API
  // ──────────────────────────────────────
  router.get('/comments', (_req: Request, res: Response) => {
    try {
      if (fs.existsSync(COMMENTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
        res.json(data);
      } else {
        res.json({});
      }
    } catch {
      res.json({});
    }
  });

  router.post('/comments', (req: Request, res: Response) => {
    try {
      const { prototype, comment, lineNumber, author } = req.body as {
        prototype: string; comment: string; lineNumber?: number; author?: string;
      };
      if (!prototype || !comment) {
        res.status(400).json({ error: 'prototype and comment are required' });
        return;
      }
      let data: Record<string, any[]> = {};
      if (fs.existsSync(COMMENTS_FILE)) {
        data = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
      }
      if (!data[prototype]) data[prototype] = [];
      data[prototype].push({
        id: Date.now().toString(36), comment,
        lineNumber: lineNumber || null,
        author: author || 'reviewer',
        timestamp: new Date().toISOString(), resolved: false,
      });
      fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true, total: data[prototype].length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ──────────────────────────────────────
  // Serve the review UI
  // ──────────────────────────────────────
  router.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getReviewHTML());
  });

  app.use('/review', router);
  console.error('  Review UI:      http://localhost:' + (process.env.PORT || 3000) + '/review');
}


function getReviewHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ampliwork — Prototype Review</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #020617; --bg-card: #0f172a; --bg-hover: #1e293b;
      --cyan: #00A3FF; --cyan-glow: rgba(0,163,255,0.25);
      --text: #cbd5e1; --text-dim: #64748b; --white: #f8fafc;
      --border: rgba(255,255,255,0.06); --radius: 16px;
    }
    body { font-family:'Inter',-apple-system,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; -webkit-font-smoothing:antialiased; }

    /* Layout */
    .shell { display:grid; grid-template-columns:280px 1fr; min-height:100vh; }

    /* Sidebar */
    .sidebar { background:var(--bg-card); border-right:1px solid var(--border); padding:24px 20px; display:flex; flex-direction:column; gap:20px; position:sticky; top:0; height:100vh; overflow-y:auto; }
    .sidebar-brand { display:flex; align-items:center; gap:12px; padding-bottom:20px; border-bottom:1px solid var(--border); }
    .sidebar-brand img { width:36px; height:36px; border-radius:8px; object-fit:cover; }
    .sidebar-brand h1 { font-size:16px; font-weight:700; color:var(--white); }
    .sidebar-brand span { font-size:10px; font-weight:600; color:var(--cyan); text-transform:uppercase; letter-spacing:1px; }
    .file-list { display:flex; flex-direction:column; gap:2px; flex:1; }
    .file-item { display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:10px; cursor:pointer; transition:all .2s; border:1px solid transparent; font-size:12px; font-weight:500; color:var(--text); }
    .file-item:hover { background:var(--bg-hover); }
    .file-item.active { background:rgba(0,163,255,0.08); border-color:rgba(0,163,255,0.2); color:var(--cyan); }
    .file-item .dot { width:6px; height:6px; border-radius:50%; background:var(--text-dim); flex-shrink:0; }
    .file-item.active .dot { background:var(--cyan); box-shadow:0 0 8px var(--cyan); }
    .ampli-badge { margin-left:auto; font-size:9px; font-weight:700; color:var(--cyan); background:rgba(0,163,255,0.1); padding:2px 6px; border-radius:999px; border:1px solid rgba(0,163,255,0.2); }

    /* Main */
    .main { display:flex; flex-direction:column; overflow:hidden; }

    /* Toolbar */
    .main-toolbar { display:flex; align-items:center; justify-content:space-between; padding:12px 24px; border-bottom:1px solid var(--border); background:var(--bg-card); flex-shrink:0; }
    .main-toolbar h2 { font-size:14px; font-weight:600; color:var(--white); }
    .tab-bar { display:flex; gap:4px; }
    .tab { padding:6px 16px; border-radius:999px; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s; border:1px solid transparent; color:var(--text-dim); background:transparent; }
    .tab:hover { color:var(--text); }
    .tab.active { background:rgba(0,163,255,0.1); color:var(--cyan); border-color:rgba(0,163,255,0.2); }

    /* Preview Panel */
    .preview-panel { flex:1; position:relative; background:#0a0f1e; overflow:hidden; }
    .preview-panel iframe { width:100%; height:100%; border:none; background:#fff; }
    .preview-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:var(--bg); z-index:5; }
    .preview-loading.hidden { display:none; }
    .spinner { width:32px; height:32px; border:3px solid var(--border); border-top-color:var(--cyan); border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* Code Panel */
    .code-panel { display:none; flex:1; overflow:auto; background:var(--bg-card); }
    .code-panel.visible { display:block; }
    .code-panel pre { font-family:'Cascadia Code','Fira Code',monospace; font-size:12px; line-height:1.7; color:var(--text); padding:20px; white-space:pre-wrap; word-break:break-word; }
    .code-line { display:flex; padding:0 4px; min-height:20px; cursor:pointer; border-radius:3px; transition:background .1s; }
    .code-line:hover { background:rgba(0,163,255,0.04); }
    .code-line.has-comment { background:rgba(0,163,255,0.06); border-left:3px solid var(--cyan); padding-left:6px; }
    .line-num { width:40px; text-align:right; padding-right:12px; color:var(--text-dim); user-select:none; font-size:11px; flex-shrink:0; }

    /* Comments Drawer */
    .comments-drawer { border-top:1px solid var(--border); background:var(--bg-card); max-height:220px; overflow-y:auto; flex-shrink:0; }
    .comments-drawer.empty { max-height:60px; }
    .comments-header { padding:10px 20px; font-size:12px; font-weight:600; color:var(--text-dim); display:flex; justify-content:space-between; border-bottom:1px solid var(--border); }
    .comment-count { color:var(--cyan); }
    .comment-item { display:flex; gap:10px; padding:10px 20px; border-bottom:1px solid var(--border); }
    .comment-avatar { width:24px; height:24px; border-radius:6px; background:rgba(0,163,255,0.15); display:flex; align-items:center; justify-content:center; color:var(--cyan); font-size:10px; font-weight:700; flex-shrink:0; }
    .comment-body { flex:1; font-size:12px; }
    .comment-meta { color:var(--text-dim); font-size:10px; margin-bottom:2px; }
    .comment-line-ref { color:var(--cyan); font-weight:600; }
    .new-comment-bar { display:flex; gap:8px; padding:10px 20px; border-top:1px solid var(--border); background:rgba(15,23,42,0.5); flex-shrink:0; }
    .new-comment-bar input, .new-comment-bar textarea { background:var(--bg); border:1px solid var(--border); color:var(--white); font-family:'Inter',sans-serif; font-size:12px; padding:8px 12px; border-radius:10px; outline:none; resize:none; }
    .new-comment-bar input:focus, .new-comment-bar textarea:focus { border-color:var(--cyan); box-shadow:0 0 0 2px var(--cyan-glow); }
    .new-comment-bar textarea { flex:1; min-height:36px; }
    .new-comment-bar input { width:64px; flex:0 0 64px; }

    /* Pill Button */
    .btn-pill { display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; background:var(--cyan); color:var(--bg); font-size:12px; font-weight:700; border:none; border-radius:999px; cursor:pointer; transition:all .2s; white-space:nowrap; }
    .btn-pill:hover { background:#33b5ff; box-shadow:0 0 16px var(--cyan-glow); }

    /* Empty State */
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px; text-align:center; flex:1; }
    .empty-icon { width:64px; height:64px; border-radius:20px; background:rgba(0,163,255,0.08); display:flex; align-items:center; justify-content:center; margin-bottom:20px; border:1px solid rgba(0,163,255,0.15); }
    .empty-icon svg { width:28px; height:28px; color:var(--cyan); }
    .empty-state h3 { font-size:16px; font-weight:600; color:var(--white); margin-bottom:6px; }
    .empty-state p { font-size:13px; color:var(--text-dim); max-width:340px; }

    /* Inline popup */
    .inline-popup { position:fixed; z-index:100; background:var(--bg-card); border:1px solid rgba(0,163,255,0.3); border-radius:12px; padding:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5); width:320px; display:none; }
    .inline-popup.open { display:block; }
    .inline-popup textarea { width:100%; background:var(--bg); border:1px solid var(--border); color:var(--white); font-family:'Inter',sans-serif; font-size:12px; padding:8px 10px; border-radius:8px; outline:none; resize:none; min-height:50px; margin-bottom:8px; }
    .inline-popup textarea:focus { border-color:var(--cyan); }
    .popup-actions { display:flex; justify-content:flex-end; gap:6px; }
    .btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text); padding:5px 12px; border-radius:999px; font-size:11px; cursor:pointer; transition:all .2s; }
    .btn-ghost:hover { border-color:var(--text-dim); color:var(--white); }

    /* Scrollbar */
    ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:var(--bg-hover); border-radius:3px; } ::-webkit-scrollbar-thumb:hover { background:var(--cyan); }

    @media (max-width:768px) { .shell { grid-template-columns:1fr; } .sidebar { position:relative; height:auto; } }
  </style>
</head>
<body>
  <div class="shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <img src="/review/logo" alt="Ampliwork" onerror="this.style.display='none'" />
        <div>
          <h1>Ampliwork</h1>
          <span>Prototype Review</span>
        </div>
      </div>
      <div class="file-list" id="fileList">
        <div style="color:var(--text-dim);font-size:12px;padding:12px;">Loading…</div>
      </div>
    </aside>

    <!-- Main -->
    <main class="main" id="mainArea">
      <div class="empty-state" id="emptyState">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <h3>Select a Prototype</h3>
        <p>Choose a file from the sidebar to see it rendered live with the Ampliwork design system.</p>
      </div>
    </main>
  </div>

  <!-- Inline comment popup -->
  <div class="inline-popup" id="inlinePopup">
    <div style="font-size:11px;color:var(--cyan);font-weight:600;margin-bottom:6px;">Comment on line <span id="popupLineNum"></span></div>
    <textarea id="popupComment" placeholder="Add feedback…"></textarea>
    <div class="popup-actions">
      <button class="btn-ghost" onclick="closePopup()">Cancel</button>
      <button class="btn-pill" style="padding:5px 14px;font-size:11px;" onclick="submitInlineComment()">Add</button>
    </div>
  </div>

  <script>
    let currentFile = null;
    let allComments = {};
    let currentView = 'preview'; // 'preview' | 'code'

    // ─── TSX code is pre-extracted on the server ───
    // data.tsxCode is already available from the API response

    // ─── Build Sandpack-compatible HTML for iframe ───
    function buildPreviewHTML(tsxCode) {
      // Clean the component: replace 'use client' directive
      let code = tsxCode.replace(/^['"]use client['"]\\s*\\n?/m, '');

      // Determine the export name
      let exportName = 'App';
      const defaultExportMatch = code.match(/export default function\\s+(\\w+)/);
      if (defaultExportMatch) {
        exportName = defaultExportMatch[1];
      }

      // If component uses 'export default function X', wrap for rendering
      return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\\/script>
  <style>
    body { margin: 0; padding: 0; min-height: 100vh; }
    #root { min-height: 100vh; }
    /* Ampliwork overrides */
    .ampliwork-watermark {
      position: fixed; bottom: 12px; right: 16px; z-index: 9999;
      display: flex; align-items: center; gap: 6px;
      background: rgba(2,6,23,0.85); backdrop-filter: blur(8px);
      padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(0,163,255,0.2);
      font-family: Inter, sans-serif; font-size: 10px; color: #00A3FF; font-weight: 600;
    }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <div class="ampliwork-watermark">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00A3FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    Ampliwork Preview
  </div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    \${code}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(\${exportName}));
  <\\/script>
</body>
</html>\`;
    }

    async function loadPrototypes() {
      const res = await fetch('/review/prototypes');
      const files = await res.json();
      const list = document.getElementById('fileList');
      list.innerHTML = '';
      if (!files.length) {
        list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:12px;">No prototypes yet</div>';
        return;
      }
      files.forEach(f => {
        const el = document.createElement('div');
        el.className = 'file-item';
        el.dataset.file = f.name;
        el.innerHTML = \`<span class="dot"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${f.name}</span>\${f.isAmpliwork ? '<span class="ampli-badge">branded</span>' : ''}\`;
        el.addEventListener('click', () => selectFile(f.name));
        list.appendChild(el);
      });
    }

    async function loadComments() {
      try { const r = await fetch('/review/comments'); allComments = await r.json(); } catch { allComments = {}; }
    }

    async function selectFile(filename) {
      currentFile = filename;
      document.querySelectorAll('.file-item').forEach(el => el.classList.toggle('active', el.dataset.file === filename));
      const res = await fetch('/review/prototypes/' + encodeURIComponent(filename));
      const data = await res.json();
      await loadComments();
      renderFileView(data.filename, data.content, data.tsxCode);
    }

    function renderFileView(filename, content, tsxCode) {
      const main = document.getElementById('mainArea');
      const fileComments = allComments[filename] || [];
      const commentLines = new Set(fileComments.filter(c => c.lineNumber).map(c => c.lineNumber));
      const lines = content.split('\\n');

      const hasPreview = !!tsxCode;

      main.innerHTML = \`
        <div class="main-toolbar">
          <h2>\${filename}</h2>
          <div class="tab-bar">
            \${hasPreview ? '<button class="tab active" data-tab="preview" onclick="switchTab(\\'preview\\')">▶ Preview</button>' : ''}
            <button class="tab \${hasPreview ? '' : 'active'}" data-tab="code" onclick="switchTab(\\'code\\')">{ } Code</button>
          </div>
        </div>

        \${hasPreview ? \`
          <div class="preview-panel" id="previewPanel">
            <div class="preview-loading" id="previewLoader"><div class="spinner"></div></div>
          </div>
        \` : ''}

        <div class="code-panel \${hasPreview ? '' : 'visible'}" id="codePanel">
          <pre>\${lines.map((line, i) => {
            const num = i + 1;
            const hc = commentLines.has(num) ? ' has-comment' : '';
            return '<div class="code-line' + hc + '" data-line="' + num + '" onclick="openPopup(' + num + ', event)"><span class="line-num">' + num + '</span><span>' + escapeHtml(line) + '</span></div>';
          }).join('')}</pre>
        </div>

        <div class="comments-drawer \${fileComments.length === 0 ? 'empty' : ''}">
          <div class="comments-header">
            <span>💬 Comments</span>
            <span class="comment-count">\${fileComments.length}</span>
          </div>
          \${fileComments.map(c => \`
            <div class="comment-item">
              <div class="comment-avatar">\${(c.author||'R')[0].toUpperCase()}</div>
              <div class="comment-body">
                <div class="comment-meta">
                  <strong style="color:var(--white)">\${c.author||'reviewer'}</strong>
                  · \${new Date(c.timestamp).toLocaleTimeString()}
                  \${c.lineNumber ? ' · <span class="comment-line-ref">L' + c.lineNumber + '</span>' : ''}
                </div>
                <div>\${escapeHtml(c.comment)}</div>
              </div>
            </div>
          \`).join('')}
        </div>

        <div class="new-comment-bar">
          <input id="commentLine" type="number" placeholder="Line" min="1" />
          <textarea id="commentText" placeholder="Add feedback…" rows="1"></textarea>
          <button class="btn-pill" onclick="submitComment()">Send</button>
        </div>
      \`;

      currentView = hasPreview ? 'preview' : 'code';

      if (hasPreview) {
        // Inject live preview into iframe
        setTimeout(() => {
          const panel = document.getElementById('previewPanel');
          if (!panel) return;
          const iframe = document.createElement('iframe');
          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
          const html = buildPreviewHTML(tsxCode);
          iframe.onload = () => {
            const loader = document.getElementById('previewLoader');
            if (loader) loader.classList.add('hidden');
          };
          panel.appendChild(iframe);
          iframe.srcdoc = html;
        }, 50);
      }
    }

    function switchTab(tab) {
      currentView = tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      const pp = document.getElementById('previewPanel');
      const cp = document.getElementById('codePanel');
      if (pp) pp.style.display = tab === 'preview' ? 'block' : 'none';
      if (cp) cp.classList.toggle('visible', tab === 'code');
    }

    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // ─── Inline Comments ───
    let popupLine = null;
    function openPopup(num, ev) {
      popupLine = num;
      const popup = document.getElementById('inlinePopup');
      document.getElementById('popupLineNum').textContent = num;
      document.getElementById('popupComment').value = '';
      const r = ev.target.closest('.code-line').getBoundingClientRect();
      popup.style.top = Math.min(r.bottom + 4, window.innerHeight - 180) + 'px';
      popup.style.left = Math.min(r.left + 50, window.innerWidth - 340) + 'px';
      popup.classList.add('open');
      document.getElementById('popupComment').focus();
    }
    function closePopup() { document.getElementById('inlinePopup').classList.remove('open'); popupLine = null; }
    async function submitInlineComment() {
      const c = document.getElementById('popupComment').value.trim();
      if (!c || !currentFile || !popupLine) return;
      await fetch('/review/comments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prototype:currentFile,comment:c,lineNumber:popupLine}) });
      closePopup(); selectFile(currentFile);
    }
    async function submitComment() {
      const c = document.getElementById('commentText').value.trim();
      const l = document.getElementById('commentLine').value;
      if (!c || !currentFile) return;
      await fetch('/review/comments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prototype:currentFile,comment:c,lineNumber:l?parseInt(l):null}) });
      selectFile(currentFile);
    }
    document.addEventListener('keydown', e => { if (e.key==='Escape') closePopup(); });
    loadPrototypes();
  </script>
</body>
</html>`;
}
