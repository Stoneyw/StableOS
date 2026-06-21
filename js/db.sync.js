// StableOS — Supabase Sync Adapter
// ---------------------------------------------------------------------------
// Drop-in replacement for db.js that:
//   1. Loads all tenant data from Supabase into localStorage on boot
//   2. Keeps the SYNCHRONOUS window.DB API intact (no async refactor needed)
//   3. Mirrors every write back to Supabase in the background
//
// Usage: replace <script src="js/db.js"> with:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//   <script src="js/db.js"></script>         ← keep for sync layer
//   <script src="js/db.sync.js"></script>    ← add AFTER db.js
// ---------------------------------------------------------------------------

(function () {
  const SUPABASE_URL  = 'https://vihmrjonkeiuzjzuzzsj.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaG1yam9ua2VpdXpqenV6enNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTAyOTMsImV4cCI6MjA5NzU4NjI5M30.hIbnMUQPd3W8owt0VjQIzwOkiS74ZWbJez0DbIAsYTs';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const toSnake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  function camelify(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(camelify);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), camelify(v)]));
  }
  function snakeify(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(snakeify);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnake(k), snakeify(v)]));
  }

  // ── Supabase session ──────────────────────────────────────────────────────
  let _sbSession = null;

  // ── Boot: authenticate then sync ─────────────────────────────────────────
  // Called once on page load. Signs in with Supabase Auth, then pulls all
  // tenant data and merges it into the localStorage store that db.js uses.
  window.DB_SYNC = {
    ready: false,
    onReady: null,   // optional callback: DB_SYNC.onReady = () => { ... }

    async boot(email, password) {
      try {
        // 1. Sign in to Supabase
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { console.warn('[DB_SYNC] Supabase login failed:', error.message); return false; }
        _sbSession = data.session;

        // 2. Pull all tenant tables in parallel
        const [
          { data: companies },
          { data: users },
          { data: horses },
          { data: feed_rations },
          { data: feed_log },
          { data: health_records },
          { data: events },
          { data: tasks },
          { data: invoices },
          { data: messages }
        ] = await Promise.all([
          sb.from('companies').select('*'),
          sb.from('users').select('*'),
          sb.from('horses').select('*'),
          sb.from('feed_rations').select('*'),
          sb.from('feed_log').select('*'),
          sb.from('health_records').select('*'),
          sb.from('events').select('*'),
          sb.from('tasks').select('*'),
          sb.from('invoices').select('*'),
          sb.from('messages').select('*')
        ]);

        // 3. Merge into the localStorage store db.js manages
        const store = JSON.parse(localStorage.getItem('stableos_v3') || 'null') || {};
        store.companies      = camelify(companies || []);
        store.users          = camelify(users || []);
        store.horses         = camelify(horses || []);
        store.feedRations    = camelify(feed_rations || []);
        store.feedLog        = camelify(feed_log || []);
        store.healthRecords  = camelify(health_records || []);
        store.events         = camelify(events || []).map(e => ({
          ...e,
          startsAt: e.startsAt, endsAt: e.endsAt
        }));
        store.tasks          = camelify(tasks || []);
        store.invoices       = camelify(invoices || []);
        store.messages       = camelify(messages || []);
        // Keep platformAdmins seed so superadmin still works locally
        if (!store.platformAdmins) store.platformAdmins = [];

        localStorage.setItem('stableos_v3', JSON.stringify(store));

        this.ready = true;
        if (typeof this.onReady === 'function') this.onReady();
        console.log('[DB_SYNC] ✓ Synced from Supabase');
        return true;
      } catch (e) {
        console.error('[DB_SYNC] Boot error:', e);
        return false;
      }
    },

    // ── Mirror writes back to Supabase ────────────────────────────────────
    // Patch window.DB methods to also write to Supabase after updating localStorage.
    // Called automatically after boot().
    _patchWrites() {
      const orig = {};
      const mirror = (method, table, buildRow) => {
        orig[method] = window.DB[method].bind(window.DB);
        window.DB[method] = function (...args) {
          const result = orig[method](...args);
          try {
            const row = buildRow(...args, result);
            if (row) {
              if (row._delete) {
                sb.from(table).delete().eq('id', row._delete).then(({ error }) => {
                  if (error) console.warn(`[DB_SYNC] delete ${table}:`, error.message);
                });
              } else if (row.id && args[0] !== undefined && typeof args[0] === 'number') {
                // update
                const { id, ...patch } = row;
                sb.from(table).update(snakeify(patch)).eq('id', id).then(({ error }) => {
                  if (error) console.warn(`[DB_SYNC] update ${table}:`, error.message);
                });
              } else {
                // insert
                sb.from(table).insert(snakeify(row)).then(({ error }) => {
                  if (error) console.warn(`[DB_SYNC] insert ${table}:`, error.message);
                });
              }
            }
          } catch (e) { console.warn('[DB_SYNC] mirror error:', e); }
          return result;
        };
      };

      // Horses
      mirror('addHorse',    'horses',    (d, r)    => r);
      mirror('updateHorse', 'horses',    (id, d, r) => r);

      // Tasks
      mirror('addTask',    'tasks', (d, r)     => r);
      mirror('updateTask', 'tasks', (id, d, r) => r);
      mirror('toggleTask', 'tasks', (id, r)    => r);
      mirror('deleteTask', 'tasks', (id)       => ({ _delete: id }));

      // Health
      mirror('addHealthRecord',    'health_records', (d, r)     => r);
      mirror('updateHealthRecord', 'health_records', (id, d, r) => r);
      mirror('deleteHealthRecord', 'health_records', (id)       => ({ _delete: id }));

      // Events
      mirror('addEvent',    'events', (d, r)     => r);
      mirror('updateEvent', 'events', (id, d, r) => r);
      mirror('deleteEvent', 'events', (id)       => ({ _delete: id }));

      // Invoices
      mirror('addInvoice',     'invoices', (d, r)     => r);
      mirror('updateInvoice',  'invoices', (id, d, r) => r);
      mirror('markInvoicePaid','invoices', (id, r)    => r);

      // Messages
      mirror('sendMessage', 'messages', (d, r)  => r);
      mirror('markRead',    'messages', (id, r) => r);

      // Feed rations
      orig.setFeedRation = window.DB.setFeedRation.bind(window.DB);
      window.DB.setFeedRation = function (horseId, meal, ration, notes = '') {
        orig.setFeedRation(horseId, meal, ration, notes);
        const auth = window.DB.getAuth();
        if (!auth) return;
        sb.from('feed_rations')
          .upsert(snakeify({ companyId: auth.companyId, horseId, meal, ration, notes }), { onConflict: 'company_id,horse_id,meal' })
          .then(({ error }) => { if (error) console.warn('[DB_SYNC] upsert feed_rations:', error.message); });
      };

      // Feed log toggle
      orig.toggleFeedLog = window.DB.toggleFeedLog.bind(window.DB);
      window.DB.toggleFeedLog = function (horseId, meal, date, uid) {
        const wasFed = window.DB.isFed(horseId, meal, date);
        orig.toggleFeedLog(horseId, meal, date, uid);
        const auth = window.DB.getAuth();
        if (!auth) return;
        if (wasFed) {
          sb.from('feed_log')
            .delete()
            .eq('company_id', auth.companyId).eq('horse_id', horseId).eq('meal', meal).eq('date', date)
            .then(({ error }) => { if (error) console.warn('[DB_SYNC] delete feed_log:', error.message); });
        } else {
          sb.from('feed_log')
            .insert(snakeify({ companyId: auth.companyId, horseId, meal, date, fedBy: uid, fedAt: new Date().toISOString() }))
            .then(({ error }) => { if (error) console.warn('[DB_SYNC] insert feed_log:', error.message); });
        }
      };

      // Users
      mirror('addUser',    'users', (d, r)     => r);
      mirror('updateUser', 'users', (id, d, r) => r);

      console.log('[DB_SYNC] ✓ Write mirroring active');
    }
  };

  // ── Override login to auto-boot sync ─────────────────────────────────────
  const origLogin = window.DB.login.bind(window.DB);
  window.DB.login = async function (email, pw) {
    const result = origLogin(email, pw);
    if (result && !result.error) {
      await window.DB_SYNC.boot(email, pw);
      window.DB_SYNC._patchWrites();
    }
    return result;
  };

  // ── Auto-restore if session already in localStorage ───────────────────────
  (async () => {
    const auth = window.DB.getAuth();
    if (auth) {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        _sbSession = session;
        window.DB_SYNC._patchWrites();
        console.log('[DB_SYNC] ✓ Session restored, write mirroring active');
      }
    }
  })();

})();
