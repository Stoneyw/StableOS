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
          { data: users },  // includes rate column now
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
        const store = JSON.parse(localStorage.getItem('stableos_v4') || 'null') || {};
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

        localStorage.setItem('stableos_v4', JSON.stringify(store));

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
      if (this._patched) { console.log('[DB_SYNC] writes already patched — skipping'); return; }
      this._patched = true;
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

      // Users — profile fields (non-password)
      orig.addUser    = window.DB.addUser.bind(window.DB);
      orig.updateUser = window.DB.updateUser.bind(window.DB);

      // addUser: save profile to users table AND create Supabase Auth account
      window.DB.addUser = async function (d) {
        const result = orig.addUser(d);
        const auth = window.DB.getAuth();
        if (!auth) return result;
        // 1. Create Supabase Auth user so they can actually sign in
        if (d.email && d.password) {
          try {
            const { data: authData, error: authErr } = await sb.auth.signUp({
              email: d.email,
              password: d.password
            });
            if (!authErr && authData?.user) {
              // 2. Insert users row with auth_id linked
              await sb.from('users').insert(snakeify({
                authId: authData.user.id,
                companyId: auth.companyId,
                name: d.name,
                email: d.email,
                role: d.role || 'boarder',
                avatar: d.name ? d.name.slice(0,2).toUpperCase() : '??',
                phone: d.phone || null
              }));
              console.log('[DB_SYNC] ✓ Created auth + users row for', d.email);
            } else {
              console.warn('[DB_SYNC] signUp error:', authErr?.message);
            }
          } catch(e) { console.warn('[DB_SYNC] addUser auth:', e); }
        } else {
          // No password — just insert users row (no auth account yet)
          await sb.from('users').insert(snakeify({
            companyId: auth.companyId,
            name: d.name, email: d.email,
            role: d.role || 'boarder',
            avatar: d.name ? d.name.slice(0,2).toUpperCase() : '??',
            phone: d.phone || null
          })).then(({error}) => { if(error) console.warn('[DB_SYNC] insert user:', error.message); });
        }
        return result;
      };

      // updateUser: save profile fields + handle password changes via Supabase Auth
      window.DB.updateUser = async function (id, d) {
        const result = orig.updateUser(id, d);
        const auth = window.DB.getAuth();
        if (!auth) return result;

        // Mirror non-password fields to Supabase users table
        const patch = {};
        ['name','email','phone','role','rate'].forEach(k => { if (d[k] !== undefined) patch[k] = d[k]; });
        if (Object.keys(patch).length) {
          sb.from('users').update(snakeify(patch)).eq('id', id)
            .then(({error}) => { if(error) console.warn('[DB_SYNC] update user:', error.message); });
        }

        // Password change
        if (d.password) {
          if (auth.userId === id) {
            // Changing own password — Supabase Auth supports this directly
            sb.auth.updateUser({ password: d.password })
              .then(({error}) => {
                if (error) console.warn('[DB_SYNC] updateUser password:', error.message);
                else console.log('[DB_SYNC] ✓ Password updated for', auth.email);
              });
          } else {
            // Changing another user's password — send them a reset email
            const target = window.DB.getUserById(id);
            if (target?.email) {
              sb.auth.resetPasswordForEmail(target.email, {
                redirectTo: window.location.origin + '/app.html'
              }).then(({error}) => {
                if (error) console.warn('[DB_SYNC] resetPassword:', error.message);
                else console.log('[DB_SYNC] ✓ Password reset email sent to', target.email);
              });
            }
          }
        }
        return result;
      };

      console.log('[DB_SYNC] ✓ Write mirroring active');
    }
  };

  // ── Override login to auto-boot sync ─────────────────────────────────────
  // Strategy: run local login first (works from seed), then pull Supabase
  // data in the background and refresh the page so the dashboard reloads
  // with live data. This avoids returning a Promise to synchronous callers.
  const origLogin = window.DB.login.bind(window.DB);
  window.DB.login = async function (email, pw) {
    // 1. Local (seed) login — synchronous, always works on first load
    const result = origLogin(email, pw);
    if (!result || result.error) return result;

    // 2. Boot Supabase in background — pull live data into localStorage
    window.DB_SYNC.boot(email, pw).then(ok => {
      if (ok) {
        window.DB_SYNC._patchWrites();
        // Reload app shell so dashboard reads fresh Supabase data
        if (typeof window.__reloadDashboard === 'function') {
          window.__reloadDashboard();
        }
      }
    });

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

        // Re-sync from Supabase in background so stale localStorage gets refreshed
        const auth = window.DB.getAuth();
        if (auth && auth.email) {
          window.DB_SYNC._resync();
        }
        console.log('[DB_SYNC] ✓ Session restored, write mirroring active');
      }
    }
  })();

  // ── Tab focus re-sync ────────────────────────────────────────────────────
  // Every time the user returns to the tab, silently pull fresh data from
  // Supabase so changes made on another device/browser are reflected.
  let _lastSync = 0;
  window.DB_SYNC._resync = async function() {
    if (!_sbSession) return;
    const now = Date.now();
    if (now - _lastSync < 30000) return; // debounce: max once per 30s
    _lastSync = now;
    try {
      const [
        { data: companies }, { data: users }, { data: horses },
        { data: feed_rations }, { data: feed_log }, { data: health_records },
        { data: events }, { data: tasks }, { data: invoices }, { data: messages }
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
      const store = JSON.parse(localStorage.getItem('stableos_v4') || 'null') || {};
      store.companies     = camelify(companies || []);
      store.users         = camelify(users || []);
      store.horses        = camelify(horses || []);
      store.feedRations   = camelify(feed_rations || []);
      store.feedLog       = camelify(feed_log || []);
      store.healthRecords = camelify(health_records || []);
      store.events        = camelify(events || []);
      store.tasks         = camelify(tasks || []);
      store.invoices      = camelify(invoices || []);
      store.messages      = camelify(messages || []);
      localStorage.setItem('stableos_v4', JSON.stringify(store));
      // Notify app to re-render if it's listening
      window.dispatchEvent(new CustomEvent('db-sync-refresh'));
      console.log('[DB_SYNC] ✓ Re-synced from Supabase at', new Date().toLocaleTimeString());
    } catch(e) { console.warn('[DB_SYNC] re-sync error:', e); }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.DB_SYNC._resync();
  });

})();
