// StableOS — Supabase Data Layer
// Drop-in async replacement for js/db.js
// All window.DB methods now return Promises — callers must await them.
//
// Setup:
//   1. Add to your HTML BEFORE app scripts:
//      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//   2. Replace js/db.js with js/db.supabase.js in your HTML
//   3. Set your project URL + anon key below
// ---------------------------------------------------------------------------

(function () {
  const SUPABASE_URL  = 'https://vihmrjonkeiuzjzuzzsj.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaG1yam9ua2VpdXpqenV6enNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTAyOTMsImV4cCI6MjA5NzU4NjI5M30.hIbnMUQPd3W8owt0VjQIzwOkiS74ZWbJez0DbIAsYTs';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  // ── Session cache ─────────────────────────────────────────────────────────
  let _auth   = null;   // tenant session  { userId, companyId, name, email, role, avatar, barnName }
  let _padmin = null;   // platform admin  { id, name, email }

  // Build the same session shape the old db.js produced
  async function _buildSession(authUser) {
    const { data: u } = await sb.from('users')
      .select('id, company_id, name, email, role, avatar, companies(name)')
      .eq('auth_id', authUser.id)
      .single();
    if (!u) return null;
    return {
      userId:    u.id,
      companyId: u.company_id,
      name:      u.name,
      email:     u.email,
      role:      u.role,
      avatar:    u.avatar || u.name.slice(0, 2).toUpperCase(),
      barnName:  u.companies?.name || 'StableOS'
    };
  }

  // ── Snake ↔ camel helpers ─────────────────────────────────────────────────
  // The old db.js used camelCase keys; Postgres uses snake_case.
  // These converters let the rest of the app keep working unchanged.
  const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  function camelify(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(camelify);
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamel(k), camelify(v)])
    );
  }
  const toSnake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  function snakeify(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(snakeify);
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnake(k), snakeify(v)])
    );
  }

  // ── Low-level helpers ─────────────────────────────────────────────────────
  async function all(table, extra = q => q) {
    const { data, error } = await extra(sb.from(table).select('*'));
    if (error) throw error;
    return camelify(data || []);
  }
  async function one(table, id) {
    const { data, error } = await sb.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return camelify(data);
  }
  async function insert(table, row) {
    const { data, error } = await sb.from(table).insert(snakeify(row)).select().single();
    if (error) throw error;
    return camelify(data);
  }
  async function update(table, id, patch) {
    const { data, error } = await sb.from(table).update(snakeify(patch)).eq('id', id).select().single();
    if (error) throw error;
    return camelify(data);
  }
  async function remove(table, id) {
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw error;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.DB = {

    // ── Tenant auth ────────────────────────────────────────────────────────
    getAuth: () => _auth,

    async login(email, pw) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error || !data.user) return null;
      const company = await sb.from('companies')
        .select('status, name')
        .eq('owner_email', email)
        .maybeSingle();
      if (company?.data?.status === 'suspended') {
        return { error: 'suspended', barnName: company.data.name };
      }
      _auth = await _buildSession(data.user);
      return _auth;
    },

    async logout() {
      await sb.auth.signOut();
      _auth = null;
    },

    // Re-hydrate session on page load (call once on app boot)
    async restoreSession() {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        _auth = await _buildSession(session.user);
      }
      return _auth;
    },

    // ── Sign up (onboarding) ────────────────────────────────────────────────
    async signup(form) {
      // 1. Create Supabase Auth user
      const { data: authData, error: authErr } = await sb.auth.signUp({
        email: form.email,
        password: form.password || 'StableOS123'
      });
      if (authErr) throw authErr;

      // 2. Create company
      const now = new Date();
      const slug = (form.barnName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: company } = await sb.from('companies').insert({
        name: form.barn_name || form.barnName || 'New Stable',
        slug: slug || ('stable-' + Date.now()),
        location: form.address || '',
        address: form.address || '',
        phone: form.phone || '',
        plan: form.plan || 'Professional',
        facility_type: form.facilityType || 'Boarding facility',
        status: 'trial',
        joined: now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        owner_email: form.email
      }).select().single();

      // 3. Create owner user row
      const ownerName = form.ownerName || form.email.split('@')[0];
      const { data: owner } = await sb.from('users').insert({
        auth_id: authData.user.id,
        company_id: company.id,
        name: ownerName,
        email: form.email,
        role: 'owner',
        avatar: ownerName.slice(0, 2).toUpperCase()
      }).select().single();

      // 4. Optional: first staff member from onboarding wizard
      if (form.staffName && form.staffEmail) {
        const roleMap = {
          'Stable Owner': 'owner', 'Manager': 'manager',
          'Staff / Groom': 'staff', 'Trainer': 'trainer', 'Boarder / Client': 'boarder'
        };
        await sb.from('users').insert({
          company_id: company.id,
          name: form.staffName,
          email: form.staffEmail,
          role: roleMap[form.staffRole] || 'staff',
          avatar: form.staffName.slice(0, 2).toUpperCase()
        });
      }

      _auth = await _buildSession(authData.user);
      return { token: authData.session?.access_token, company: camelify(company), user: camelify(owner) };
    },

    // ── Company ────────────────────────────────────────────────────────────
    async getBarn() {
      const { data } = await sb.from('companies').select('*').eq('id', _auth.companyId).single();
      return camelify(data) || {};
    },
    async updateBarn(patch) {
      return update('companies', _auth.companyId, patch);
    },

    // ── Horses ─────────────────────────────────────────────────────────────
    async getHorses(f = {}) {
      let q = sb.from('horses').select('*').eq('company_id', _auth.companyId);
      if (f.status)   q = q.eq('status', f.status);
      if (f.ownerId !== undefined) q = q.eq('owner_id', f.ownerId);
      const { data, error } = await q;
      if (error) throw error;
      return camelify(data || []);
    },
    async getHorseById(id) { return one('horses', id); },
    async addHorse(d) {
      return insert('horses', { ...d, companyId: _auth.companyId, status: d.status || 'active' });
    },
    async updateHorse(id, d) { return update('horses', id, d); },

    // ── Feeding ────────────────────────────────────────────────────────────
    async getFeedRations(horseId) {
      let q = sb.from('feed_rations').select('*').eq('company_id', _auth.companyId);
      if (horseId) q = q.eq('horse_id', horseId);
      const { data } = await q;
      return camelify(data || []);
    },
    async setFeedRation(horseId, meal, ration, notes = '') {
      const { data: existing } = await sb.from('feed_rations')
        .select('id').eq('company_id', _auth.companyId)
        .eq('horse_id', horseId).eq('meal', meal).maybeSingle();
      if (existing) {
        return update('feed_rations', existing.id, { ration, notes });
      } else {
        return insert('feed_rations', { companyId: _auth.companyId, horseId, meal, ration, notes });
      }
    },
    async getFeedLog(date) {
      const { data } = await sb.from('feed_log').select('*')
        .eq('company_id', _auth.companyId).eq('date', date);
      return camelify(data || []);
    },
    async isFed(horseId, meal, date) {
      const { data } = await sb.from('feed_log').select('id')
        .eq('company_id', _auth.companyId).eq('horse_id', horseId)
        .eq('meal', meal).eq('date', date).maybeSingle();
      return !!data;
    },
    async toggleFeedLog(horseId, meal, date, uid) {
      const { data: existing } = await sb.from('feed_log').select('id')
        .eq('company_id', _auth.companyId).eq('horse_id', horseId)
        .eq('meal', meal).eq('date', date).maybeSingle();
      if (existing) {
        await remove('feed_log', existing.id);
      } else {
        await insert('feed_log', { companyId: _auth.companyId, horseId, meal, date, fedBy: uid, fedAt: new Date().toISOString() });
      }
    },

    // ── Health ─────────────────────────────────────────────────────────────
    async getHealthRecords(horseId) {
      let q = sb.from('health_records').select('*').eq('company_id', _auth.companyId).order('performed_on', { ascending: false });
      if (horseId) q = q.eq('horse_id', horseId);
      const { data } = await q;
      return camelify(data || []);
    },
    async addHealthRecord(d) {
      return insert('health_records', { ...d, companyId: _auth.companyId });
    },
    async updateHealthRecord(id, d) { return update('health_records', id, d); },
    async deleteHealthRecord(id)    { return remove('health_records', id); },
    async getDueRecords() {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 45);
      const { data } = await sb.from('health_records').select('*')
        .eq('company_id', _auth.companyId)
        .not('next_due_on', 'is', null)
        .lte('next_due_on', cutoff.toISOString().split('T')[0])
        .order('next_due_on');
      const now = Date.now();
      return camelify(data || []).map(r => ({
        ...r,
        _days: Math.ceil((new Date(r.nextDueOn) - now) / 86400000)
      }));
    },

    // ── Events ─────────────────────────────────────────────────────────────
    async getEvents(from, to) {
      let q = sb.from('events').select('*').eq('company_id', _auth.companyId).order('starts_at');
      if (from) q = q.gte('starts_at', from);
      if (to)   q = q.lte('starts_at', to);
      const { data } = await q;
      return camelify(data || []);
    },
    async addEvent(d)            { return insert('events', { ...d, companyId: _auth.companyId }); },
    async updateEvent(id, d)     { return update('events', id, d); },
    async deleteEvent(id)        { return remove('events', id); },

    // ── Tasks ──────────────────────────────────────────────────────────────
    async getTasks(f = {}) {
      let q = sb.from('tasks').select('*').eq('company_id', _auth.companyId);
      if (f.done !== undefined)  q = q.eq('done', f.done);
      if (f.assigneeId)          q = q.eq('assignee_id', f.assigneeId);
      const { data } = await q;
      const p = { high: 0, normal: 1, low: 2 };
      return camelify(data || []).sort((a, b) =>
        a.done !== b.done ? (a.done ? 1 : -1) : (p[a.priority] || 1) - (p[b.priority] || 1)
      );
    },
    async addTask(d)   { return insert('tasks', { ...d, companyId: _auth.companyId, done: false }); },
    async updateTask(id, d) { return update('tasks', id, d); },
    async deleteTask(id)    { return remove('tasks', id); },
    async toggleTask(id) {
      const t = await one('tasks', id);
      return update('tasks', id, { done: !t.done, doneAt: !t.done ? new Date().toISOString() : null });
    },

    // ── Invoices ───────────────────────────────────────────────────────────
    async getInvoices(f = {}) {
      let q = sb.from('invoices').select('*').eq('company_id', _auth.companyId).order('number', { ascending: false });
      if (f.boarderId) q = q.eq('boarder_id', f.boarderId);
      if (f.status)    q = q.eq('status', f.status);
      const { data } = await q;
      return camelify(data || []);
    },
    async addInvoice(d) {
      const count = (await sb.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', _auth.companyId)).count || 0;
      return insert('invoices', {
        ...d,
        companyId: _auth.companyId,
        number: d.number || `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
        status: d.status || 'sent'
      });
    },
    async updateInvoice(id, d)  { return update('invoices', id, d); },
    async markInvoicePaid(id)   { return update('invoices', id, { status: 'paid', paidOn: new Date().toISOString().split('T')[0] }); },

    // ── Messages ───────────────────────────────────────────────────────────
    async getMessages() {
      const { data } = await sb.from('messages').select('*')
        .eq('company_id', _auth.companyId).order('created_at', { ascending: false });
      return camelify(data || []);
    },
    async sendMessage(d) {
      return insert('messages', { ...d, companyId: _auth.companyId, createdAt: new Date().toISOString() });
    },
    async markRead(id) { return update('messages', id, { readAt: new Date().toISOString() }); },
    async unreadCount() {
      const { count } = await sb.from('messages').select('*', { count: 'exact', head: true })
        .eq('company_id', _auth.companyId).is('read_at', null);
      return count || 0;
    },

    // ── Users (current tenant) ─────────────────────────────────────────────
    async getUsers() {
      const { data } = await sb.from('users').select('id, company_id, name, email, role, avatar, phone')
        .eq('company_id', _auth.companyId);
      return camelify(data || []);
    },
    async getUserById(id) {
      const { data } = await sb.from('users').select('id, company_id, name, email, role, avatar, phone').eq('id', id).single();
      return camelify(data);
    },
    async getBoarders() {
      const { data } = await sb.from('users').select('id, company_id, name, email, role, avatar, phone')
        .eq('company_id', _auth.companyId).eq('role', 'boarder');
      return camelify(data || []);
    },
    async getStaff() {
      const { data } = await sb.from('users').select('id, company_id, name, email, role, avatar, phone')
        .eq('company_id', _auth.companyId).neq('role', 'boarder');
      return camelify(data || []);
    },
    async addUser(d) {
      return insert('users', { ...d, companyId: _auth.companyId, avatar: d.avatar || d.name.slice(0, 2).toUpperCase() });
    },
    async updateUser(id, d) {
      const patch = {};
      ['name', 'email', 'phone', 'role'].forEach(k => { if (d[k] !== undefined) patch[k] = d[k]; });
      if (d.name) patch.avatar = d.name.slice(0, 2).toUpperCase();
      return update('users', id, patch);
    },

    // ════ Platform admin ═══════════════════════════════════════════════════
    getPlatformAuth: () => _padmin,

    async platformLogin(email, pw) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error || !data.user) return null;
      const { data: admin } = await sb.from('platform_admins').select('*').eq('auth_id', data.user.id).single();
      if (!admin) { await sb.auth.signOut(); return null; }
      _padmin = { id: admin.id, name: admin.name, email: admin.email };
      return _padmin;
    },

    async platformLogout() {
      await sb.auth.signOut();
      _padmin = null;
    },

    async restorePlatformSession() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return null;
      const { data: admin } = await sb.from('platform_admins').select('*').eq('auth_id', session.user.id).maybeSingle();
      if (admin) _padmin = { id: admin.id, name: admin.name, email: admin.email };
      return _padmin;
    },

    PLAN_MRR: { Basic: 99, Professional: 199, Enterprise: 399 },

    async adminGetCompanies() {
      const { data: cos } = await sb.from('companies').select('*');
      const { data: horses } = await sb.from('horses').select('id, company_id, status');
      const { data: users } = await sb.from('users').select('id, company_id, role, name, email');
      return (cos || []).map(c => ({
        id: c.id, name: c.name, slug: c.slug, loc: c.location, plan: c.plan,
        status: c.status, joined: c.joined, ownerEmail: c.owner_email,
        horses: (horses || []).filter(h => h.company_id === c.id && h.status === 'active').length,
        users:  (users  || []).filter(u => u.company_id === c.id).length,
        owner: (users   || []).find(u => u.company_id === c.id && u.role === 'owner')?.name || '—'
      }));
    },

    async adminStats() {
      const { data: cos } = await sb.from('companies').select('plan, status');
      const { data: horses } = await sb.from('horses').select('status');
      const MRR = this.PLAN_MRR;
      const active = (cos || []).filter(c => c.status === 'active');
      return {
        mrr:       active.reduce((s, c) => s + (MRR[c.plan] || 0), 0),
        active:    active.length,
        trial:     (cos || []).filter(c => c.status === 'trial').length,
        suspended: (cos || []).filter(c => c.status === 'suspended').length,
        horses:    (horses || []).filter(h => h.status === 'active').length,
        total:     (cos || []).length
      };
    },

    async adminAddCompany(form) {
      const slug = (form.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: company } = await sb.from('companies').insert({
        name: form.name, slug, location: form.loc || '—',
        plan: form.plan || 'Professional',
        facility_type: form.facilityType || 'Boarding facility',
        status: 'trial',
        joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        owner_email: form.email
      }).select().single();
      const name = form.owner || form.email.split('@')[0];
      await sb.from('users').insert({
        company_id: company.id, name, email: form.email, role: 'owner',
        avatar: name.slice(0, 2).toUpperCase()
      });
      return camelify(company);
    },

    async adminChangePlan(companyId, plan) {
      return update('companies', companyId, { plan });
    },

    async adminSetStatus(companyId, status) {
      return update('companies', companyId, { status });
    },

    async adminImpersonate(companyId) {
      // In production use Supabase service-role key on the server side.
      // Client-side impersonation: load the company's data into the local session.
      const { data: owner } = await sb.from('users')
        .select('*, companies(name)')
        .eq('company_id', companyId).eq('role', 'owner').single();
      if (!owner) return null;
      _auth = {
        userId: owner.id, companyId: owner.company_id, name: owner.name,
        email: owner.email, role: owner.role,
        avatar: owner.avatar || owner.name.slice(0, 2).toUpperCase(),
        barnName: owner.companies?.name || 'StableOS'
      };
      return _auth;
    }
  };
})();
