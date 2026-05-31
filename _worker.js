// BriefBot — Cloudflare Pages _worker.js
// Servar både statiska filer och API från samma domän
// https://briefbot.se/ → index.html
// https://briefbot.se/api/* → API-hantering
// https://briefbot.se/app.js → static file
// https://briefbot.se/app.css → static file

// ====== Auth (Web Crypto JWT, no deps) ======
function b64url(b) { return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function fb64(s) { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer; }
function b64d(s) { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; try{return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0))));}catch{return null;} }
async function gk(s){return await crypto.subtle.importKey('raw',new TextEncoder().encode(s),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function hashPw(p){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p+'briefbot-salt')))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function jwt(userId,email,secret){const k=await gk(secret);const h=b64url(new TextEncoder().encode(JSON.stringify({alg:'HS256'})));const p=b64url(new TextEncoder().encode(JSON.stringify({sub:String(userId),email,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7*86400})));const s=b64url(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(h+'.'+p))));return h+'.'+p+'.'+s;}
async function vfy(token,secret){try{const p=token.split('.');if(p.length!==3)return null;const k=await gk(secret);if(!await crypto.subtle.verify('HMAC',k,fb64(p[2]),new TextEncoder().encode(p[0]+'.'+p[1])))return null;const pl=b64d(p[1]);if(!pl||(pl.exp&&pl.exp<Math.floor(Date.now()/1000)))return null;return{userId:parseInt(pl.sub),email:pl.email};}catch{return null;}}

// ====== Database helpers ======
async function q(d1,sql,params=[]){const stmt=d1.prepare(sql);if(params.length>0)stmt.bind(...params);return(await stmt.all()).results||[];}
async function g1(d1,sql,params=[]){const rows=await q(d1,sql,params);return rows[0]||null;}
async function ex(d1,sql,params=[]){const stmt=d1.prepare(sql);if(params.length>0)stmt.bind(...params);return await stmt.run();}

// ====== Response helpers ======
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
function j(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-cache'}});}
function e(msg,s=400){return j({error:msg},s);}
function gt(r){const a=r.headers.get('Authorization');return(a&&a.startsWith('Bearer '))?a.slice(7):null;}
async function wa(r,d1,secret,fn){const p=await vfy(gt(r)||'',secret);if(!p)return e('Unauthorized',401);return fn(p);}

// ====== Static files ======
async function serveStatic(path, env) {
  // In Pages, asset fetch is available via env.ASSETS
  if (typeof env.ASSETS !== 'undefined') {
    try {
      return await env.ASSETS.fetch(new Request(`https://briefbot.se${path}`));
    } catch {
      // Fall through to index.html
    }
  }
  
  // Fallback: serve index.html for SPA routing
  if (typeof env.ASSETS !== 'undefined') {
    try {
      return await env.ASSETS.fetch(new Request('https://briefbot.se/index.html'));
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }
  return new Response('Not Found', { status: 404 });
}

// ====== Brief AI ======
async function genBrief(topic, xaiKey) {
  if (!xaiKey) return templateBrief(topic);
  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${xaiKey}`},body:JSON.stringify({model:'grok-4.20-0309-reasoning',messages:[{role:'system',content:'Du är BriefBot. Skapa en kort marknadsbrief på svenska.'},{role:'user',content:`Generera marknadsbevakning för: "${topic.name}". Nyckelord: ${topic.keywords||topic.name}. ${topic.sources?'Källor: '+topic.sources:''}. Språk: Svenska.`}],max_tokens:1500,temperature:0.3})});
    if(!r.ok)throw new Error(`xAI ${r.status}`);
    const d=await r.json();const c=d.choices?.[0]?.message?.content||'';
    const s=c.split('\n\n')[0]?.slice(0,300)||c.slice(0,200);
    return{title:`Brief: ${topic.name} — ${new Date().toLocaleDateString('sv-SE')}`,content:c,summary:s,sources:[]};
  }catch{return templateBrief(topic);}
}
function templateBrief(topic){return{title:`Brief: ${topic.name}`,content:`# ${topic.name}\n\nBevakning aktiv.\n\nNyckelord: ${topic.keywords||topic.name}\n\n*Väntar på AI-generering.*`,summary:`Bevakning för "${topic.name}" aktiv.`,sources:[]};}

// ====== Init schema ======
async function initSchema(d1) {
  const tables = {users:'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT,phone TEXT,subscription_status TEXT DEFAULT \'inactive\',subscription_expires TEXT,created_at TEXT DEFAULT (datetime(\'now\')),updated_at TEXT DEFAULT (datetime(\'now\')))',topics:'CREATE TABLE IF NOT EXISTS topics(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,name TEXT NOT NULL,keywords TEXT,sources TEXT,language TEXT DEFAULT \'sv\',frequency TEXT DEFAULT \'daily\',active INTEGER DEFAULT 1,created_at TEXT DEFAULT (datetime(\'now\')),updated_at TEXT DEFAULT (datetime(\'now\')),FOREIGN KEY(user_id)REFERENCES users(id)ON DELETE CASCADE)',briefs:'CREATE TABLE IF NOT EXISTS briefs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,topic_id INTEGER NOT NULL,title TEXT,content TEXT NOT NULL,summary TEXT,sources_json TEXT,delivered_at TEXT,created_at TEXT DEFAULT (datetime(\'now\')),FOREIGN KEY(user_id)REFERENCES users(id)ON DELETE CASCADE,FOREIGN KEY(topic_id)REFERENCES topics(id)ON DELETE CASCADE)',payments:'CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,swish_payment_id TEXT,amount INTEGER NOT NULL,status TEXT DEFAULT \'pending\',phone TEXT,created_at TEXT DEFAULT (datetime(\'now\')),paid_at TEXT,FOREIGN KEY(user_id)REFERENCES users(id)ON DELETE CASCADE)'};
  for (const [name, sql] of Object.entries(tables)) try{await ex(d1,sql);console.log(`Init ${name}`)}catch(e){console.error(`Schema ${name}: ${e.message}`);}
}

// ====== Main handler (ES Module export for Cloudflare Workers) ======
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // If not API, serve static files
    if (!path.startsWith('/api/')) return serveStatic(path, env);

    const d1 = env.BRIEFBOT_DB;
    const JS = env.JWT_SECRET || 'briefbot-default-secret';
    const XK = env.XAI_API_KEY;

    // Init schema in background
    ctx.waitUntil(initSchema(d1));

    try {
      let body = {};
      if (['POST','PUT'].includes(method)) try { body = await request.json(); } catch {}

      // ====== PUBLIC API ======

      // POST /api/auth/signup
      if (path === '/api/auth/signup' && method === 'POST') {
        const { email, password, name, phone } = body;
        if (!email || !password || password.length < 6) return e('Email och lösenord krävs (minst 6 tecken)');
        if (await g1(d1, 'SELECT id FROM users WHERE email=?', [email])) return e('Email finns redan', 409);
        const hash = await hashPw(password);
        const r = await ex(d1, 'INSERT INTO users(email,password_hash,name,phone) VALUES(?,?,?,?)', [email, hash, name, phone||null]);
        const uid = r.meta?.last_row_id;
        const token = await jwt(uid, email, JS);
        return j({ token, user: { id: uid, email, name, phone, subscription_status: 'inactive' } }, 201);
      }

      // POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = body;
        if (!email || !password) return e('Email och lösenord krävs');
        const user = await g1(d1, 'SELECT * FROM users WHERE email=?', [email]);
        if (!user || (await hashPw(password)) !== user.password_hash) return e('Felaktig email eller lösenord', 401);
        const token = await jwt(user.id, user.email, JS);
        return j({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, subscription_status: user.subscription_status, subscription_expires: user.subscription_expires, created_at: user.created_at } });
      }

      // GET /api/health
      if (path === '/api/health') return j({ status: 'ok', service: 'briefbot', env: typeof env.BRIEFBOT_DB !== 'undefined' ? 'd1_ok' : 'no_d1' });

      // ====== AUTH REQUIRED ======

      // GET /api/me
      if (path === '/api/me' && method === 'GET') return wa(request, d1, JS, async u => {
        const user = await g1(d1, 'SELECT id,email,name,phone,subscription_status,subscription_expires,created_at FROM users WHERE id=?', [u.userId]);
        return j({ user });
      });

      // PUT /api/me
      if (path === '/api/me' && method === 'PUT') return wa(request, d1, JS, async u => {
        await ex(d1, "UPDATE users SET name=?,phone=?,updated_at=datetime('now') WHERE id=?", [body.name||'', body.phone||'', u.userId]);
        const user = await g1(d1, 'SELECT id,email,name,phone,subscription_status,subscription_expires,created_at FROM users WHERE id=?', [u.userId]);
        return j({ user });
      });

      // GET /api/topics
      if (path === '/api/topics' && method === 'GET') return wa(request, d1, JS, async u => {
        return j({ topics: await q(d1, 'SELECT * FROM topics WHERE user_id=? ORDER BY created_at DESC', [u.userId]) });
      });

      // POST /api/topics
      if (path === '/api/topics' && method === 'POST') return wa(request, d1, JS, async u => {
        if (!body.name) return e('Namn krävs');
        const r = await ex(d1, 'INSERT INTO topics(user_id,name,keywords,sources,frequency) VALUES(?,?,?,?,?)', [u.userId, body.name, body.keywords||null, body.sources||null, body.frequency||'daily']);
        return j({ topic: { id: r.meta?.last_row_id, name: body.name, keywords: body.keywords, sources: body.sources, frequency: body.frequency||'daily', active: 1 } }, 201);
      });

      // PUT /api/topics/:id
      const tm = path.match(/^\/api\/topics\/(\d+)$/);
      if (tm && method === 'PUT') return wa(request, d1, JS, async u => {
        await ex(d1, "UPDATE topics SET name=?,keywords=?,sources=?,frequency=?,updated_at=datetime('now') WHERE id=? AND user_id=?", [body.name, body.keywords||null, body.sources||null, body.frequency||'daily', tm[1], u.userId]);
        const t = await g1(d1, 'SELECT * FROM topics WHERE id=? AND user_id=?', [tm[1], u.userId]);
        return t ? j({ topic: t }) : e('Not found', 404);
      });
      if (tm && method === 'DELETE') return wa(request, d1, JS, async u => {
        await ex(d1, 'DELETE FROM topics WHERE id=? AND user_id=?', [tm[1], u.userId]);
        return j({ success: true });
      });

      // GET /api/briefs
      if (path === '/api/briefs' && method === 'GET') return wa(request, d1, JS, async u => {
        const l = parseInt(url.searchParams.get('limit')) || 20;
        return j({ briefs: await q(d1, 'SELECT b.*,t.name as topic_name FROM briefs b JOIN topics t ON b.topic_id=t.id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT ?', [u.userId, l]) });
      });

      // GET /api/briefs/:id
      const bm = path.match(/^\/api\/briefs\/(\d+)$/);
      if (bm && method === 'GET') return wa(request, d1, JS, async u => {
        const b = await g1(d1, 'SELECT b.*,t.name as topic_name FROM briefs b JOIN topics t ON b.topic_id=t.id WHERE b.id=? AND b.user_id=?', [bm[1], u.userId]);
        return b ? j({ brief: b }) : e('Not found', 404);
      });

      // POST /api/briefs/generate
      if (path === '/api/briefs/generate' && method === 'POST') return wa(request, d1, JS, async u => {
        const usr = await g1(d1, 'SELECT subscription_status FROM users WHERE id=?', [u.userId]);
        if (usr?.subscription_status !== 'active') return e('Prenumeration krävs', 402);
        const topics = await q(d1, 'SELECT * FROM topics WHERE user_id=? AND active=1', [u.userId]);
        const results = [];
        for (const t of topics) {
          const b = await genBrief(t, XK);
          const r = await ex(d1, "INSERT INTO briefs(user_id,topic_id,title,content,summary,sources_json,delivered_at) VALUES(?,?,?,?,?,?,datetime('now'))", [u.userId, t.id, b.title, b.content, b.summary, JSON.stringify(b.sources)]);
          results.push({ topicId: t.id, briefId: r.meta?.last_row_id, title: b.title });
        }
        return j({ results, count: results.length });
      });

      // POST /api/swish/pay
      if (path === '/api/swish/pay' && method === 'POST') return wa(request, d1, JS, async u => {
        const price = 9900;
        const usr = await g1(d1, 'SELECT phone FROM users WHERE id=?', [u.userId]);
        if (!usr?.phone) return e('Telefonnummer krävs');
        const r = await ex(d1, "INSERT INTO payments(user_id,amount,phone,status) VALUES(?,?,?,?)", [u.userId, price, usr.phone, 'pending']);
        const pid = r.meta?.last_row_id;
        // Auto-activate for MVP
        await ex(d1, "UPDATE payments SET status='paid',paid_at=datetime('now') WHERE id=?", [pid]);
        const expires = new Date(Date.now() + 30*86400000).toISOString();
        await ex(d1, "UPDATE users SET subscription_status='active',subscription_expires=?,updated_at=datetime('now') WHERE id=?", [expires, u.userId]);
        return j({ payment: { id: pid, amount: price, status: 'paid', plan: '99 kr/mån', swishNumber: '123 456 78 90', message: `BB-${pid}` } });
      });

      // GET /api/subscription
      if (path === '/api/subscription' && method === 'GET') return wa(request, d1, JS, async u => {
        const usr = await g1(d1, 'SELECT subscription_status,subscription_expires FROM users WHERE id=?', [u.userId]);
        const payments = await q(d1, 'SELECT * FROM payments WHERE user_id=? ORDER BY created_at DESC LIMIT 10', [u.userId]);
        return j({ subscription: usr, payments });
      });

      return e('Not found', 404);
    } catch (err) {
      console.error('[BriefBot]', err.message, err.stack);
      return e(`Serverfel: ${err.message}`, 500);
    }
  }
};
