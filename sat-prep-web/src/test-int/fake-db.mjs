/**
 * ============================================================================
 *  FAKE SUPABASE DRIVER (in-memory) — dùng cho integration test endpoint kinh tế
 * ============================================================================
 *  Thay bảng Postgres bằng Map trong RAM để chạy THẬT route + store + pure logic
 *  của app mà KHÔNG cần Supabase/creds. Mô phỏng query-builder tối thiểu mà các
 *  store money-path dùng: .from().select().eq().single()/.maybeSingle()/.order(),
 *  .insert().select().single(), .update().eq().eq().select().maybeSingle(),
 *  .upsert(..,{onConflict}), .delete(); .rpc(name, params); .auth.getUser().
 *
 *  ⚠️ KHÔNG mô phỏng RLS (đã verify riêng — memory 1.3). Test ở đây soi bất biến
 *  KINH TẾ (status code, cộng-thưởng-đúng-1-lần, không tin số client, atomic).
 *  Random/thời gian: id tăng dần theo counter để xác định (deterministic).
 * ============================================================================
 */

/** Trạng thái toàn cục (1 tiến trình test). Reset giữa các test bằng resetDb(). */
const state = {
  tables: new Map(), // tableName -> row[]
  currentUser: null, // { id } | null  (null → getUser trả lỗi = chưa đăng nhập)
  idCounter: 0,
  /** Bật/tắt từng RPC để test đường "RPC chưa tồn tại" (fail-closed / fallback). */
  rpcsDisabled: new Set(),
  /** table -> Set(cột CHƯA tồn tại) — mô phỏng migration chưa chạy (select → 42703). */
  missingCols: new Map(),
};

export function resetDb() {
  state.tables = new Map();
  state.currentUser = { id: 'test-user-0001' };
  state.idCounter = 0;
  state.rpcsDisabled = new Set();
  state.missingCols = new Map();
}

/**
 * Đánh dấu 1 số cột của bảng là CHƯA tồn tại (migration chưa chạy). Select đụng
 * cột này → trả lỗi 42703 (undefined column), y như PostgREST thật → cho phép
 * test đường fail-safe/fail-closed của store (vd loadPvpState → null → 503).
 */
export function markMissingColumns(tableName, cols) {
  state.missingCols.set(tableName, new Set(cols));
}

export function setCurrentUser(user) {
  state.currentUser = user; // {id} hoặc null
}

export function disableRpc(name) {
  state.rpcsDisabled.add(name);
}

function table(name) {
  if (!state.tables.has(name)) state.tables.set(name, []);
  return state.tables.get(name);
}

/** Seed trực tiếp 1 dòng vào bảng (bỏ qua RLS/validation). */
export function seed(tableName, row) {
  table(tableName).push({ ...row });
}

export function getRows(tableName) {
  return table(tableName).map((r) => ({ ...r }));
}

function nextId(prefix) {
  state.idCounter += 1;
  return `${prefix}-${String(state.idCounter).padStart(4, '0')}`;
}

function matchFilters(row, filters) {
  return filters.every(([col, val]) => row[col] === val);
}

/**
 * Deep-clone tại MỌI ranh giới đọc/ghi. Mấu chốt fidelity: PostgREST trả JSON
 * deserialize MỚI mỗi lần đọc (mutate object trả về KHÔNG đụng DB), và chỉ
 * UPDATE/UPSERT round-trip mới persist. Nếu fake trả tham chiếu tới JSONB lồng
 * nhau (quest_claims, vocab words, inventory) → route mutate tại chỗ sẽ "persist"
 * cả khi save*() là no-op → test xanh giả. clone() đóng lỗ đó.
 */
const clone = (v) => (v == null ? v : structuredClone(v));

function project(row, cols) {
  if (!cols || cols === '*') return clone(row);
  const wanted = cols.split(',').map((c) => c.trim().split(/\s+/)[0]);
  const out = {};
  for (const c of wanted) out[c] = clone(row[c] ?? null);
  return out;
}

// ── Query builder (thenable + chainable) ────────────────────────────────────
function makeBuilder(tableName) {
  const q = {
    table: tableName,
    op: 'select',
    filters: [],
    payload: null,
    cols: null,
    wantReturn: false,
    order: null,
    onConflict: null,
    limitN: null,
  };

  const builder = {
    select(cols) {
      if (q.op === 'select') q.cols = cols;
      else {
        q.wantReturn = true;
        q.cols = cols;
      }
      return builder;
    },
    insert(payload) {
      q.op = 'insert';
      q.payload = payload;
      return builder;
    },
    update(payload) {
      q.op = 'update';
      q.payload = payload;
      return builder;
    },
    upsert(payload, opts) {
      q.op = 'upsert';
      q.payload = payload;
      q.onConflict = opts?.onConflict ?? null;
      return builder;
    },
    delete() {
      q.op = 'delete';
      return builder;
    },
    eq(col, val) {
      q.filters.push([col, val]);
      return builder;
    },
    order(col, opts) {
      q.order = { col, asc: opts?.ascending !== false };
      return builder;
    },
    limit(n) {
      q.limitN = n;
      return builder;
    },
    single() {
      return Promise.resolve(exec(q, 'single'));
    },
    maybeSingle() {
      return Promise.resolve(exec(q, 'maybe'));
    },
    then(resolve, reject) {
      return Promise.resolve(exec(q, 'many')).then(resolve, reject);
    },
  };
  return builder;
}

function selectsMissingCol(tableName, cols) {
  const missing = state.missingCols.get(tableName);
  if (!missing || !cols || cols === '*') return null;
  const wanted = cols.split(',').map((c) => c.trim().split(/\s+/)[0]);
  const hit = wanted.find((c) => missing.has(c));
  return hit ?? null;
}

function exec(q, mode) {
  const rows = table(q.table);

  if (q.op === 'select') {
    // Migration chưa chạy: select đụng cột chưa tồn tại → 42703 (như PostgREST).
    const missingCol = selectsMissingCol(q.table, q.cols);
    if (missingCol) {
      return { data: null, error: { code: '42703', message: `column "${missingCol}" does not exist` } };
    }
    let matched = rows.filter((r) => matchFilters(r, q.filters));
    if (q.order) {
      matched = [...matched].sort((a, b) => {
        const av = a[q.order.col];
        const bv = b[q.order.col];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return q.order.asc ? cmp : -cmp;
      });
    }
    if (typeof q.limitN === 'number' && q.limitN >= 0) matched = matched.slice(0, q.limitN);
    const projected = matched.map((r) => project(r, q.cols));
    if (mode === 'single') {
      if (projected.length === 0) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      if (projected.length > 1) return { data: null, error: { code: 'PGRST114', message: 'multiple rows' } };
      return { data: projected[0], error: null };
    }
    if (mode === 'maybe') {
      return { data: projected[0] ?? null, error: null };
    }
    return { data: projected, error: null };
  }

  if (q.op === 'insert') {
    const payloads = Array.isArray(q.payload) ? q.payload : [q.payload];
    const inserted = payloads.map((p) => {
      const row = clone(p);
      if (row.id === undefined) row.id = nextId(q.table);
      rows.push(row);
      return row;
    });
    if (q.wantReturn) {
      const projected = inserted.map((r) => project(r, q.cols));
      if (mode === 'single') return { data: projected[0], error: null };
      if (mode === 'maybe') return { data: projected[0] ?? null, error: null };
      return { data: projected, error: null };
    }
    return { data: null, error: null };
  }

  if (q.op === 'update') {
    const matched = rows.filter((r) => matchFilters(r, q.filters));
    for (const r of matched) Object.assign(r, clone(q.payload));
    if (q.wantReturn) {
      const projected = matched.map((r) => project(r, q.cols));
      if (mode === 'single') {
        if (projected.length === 0) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        return { data: projected[0], error: null };
      }
      if (mode === 'maybe') return { data: projected[0] ?? null, error: null };
      return { data: projected, error: null };
    }
    return { data: null, error: null };
  }

  if (q.op === 'upsert') {
    const payloads = Array.isArray(q.payload) ? q.payload : [q.payload];
    const conflict = q.onConflict;
    for (const p of payloads) {
      let existing = null;
      if (conflict) existing = rows.find((r) => r[conflict] === p[conflict]);
      if (existing) Object.assign(existing, clone(p));
      else {
        const row = clone(p);
        if (row.id === undefined) row.id = nextId(q.table);
        rows.push(row);
      }
    }
    return { data: null, error: null };
  }

  if (q.op === 'delete') {
    const remaining = rows.filter((r) => !matchFilters(r, q.filters));
    state.tables.set(q.table, remaining);
    return { data: null, error: null };
  }

  return { data: null, error: { code: 'UNKNOWN', message: 'op không hỗ trợ' } };
}

// ── RPC models (atomic mutations) ────────────────────────────────────────────
const RPCS = {
  // Mô phỏng claim_quest_reward (quest_claim_atomic.sql): khóa dòng + kiểm
  // (p_today=bucketKey, p_quest_id=itemId) đã có trong quest_claims chưa →
  // đã có: already_claimed (KHÔNG cộng); chưa: cộng coins/xp + ghi. Trả TỔNG mới.
  // Dùng chung cho quest, dailyLogin, streak, vocab reward (qua tryClaimOnceAtomic).
  claim_quest_reward({ p_user_id, p_quest_id, p_today, p_coins, p_xp }) {
    const econ = table('user_economy').find((r) => r.user_id === p_user_id);
    if (!econ) return { ok: false, reason: 'no_row', coins: 0, xp: 0 };
    const claims = econ.quest_claims && typeof econ.quest_claims === 'object' ? econ.quest_claims : {};
    const bucket = Array.isArray(claims[p_today]) ? claims[p_today] : [];
    if (bucket.includes(p_quest_id)) {
      return { ok: false, reason: 'already_claimed', coins: econ.coins, xp: econ.xp };
    }
    econ.coins += Math.max(0, p_coins ?? 0);
    econ.xp += Math.max(0, p_xp ?? 0);
    econ.quest_claims = { ...claims, [p_today]: [...bucket, p_quest_id] };
    return { ok: true, reason: 'ok', coins: econ.coins, xp: econ.xp };
  },

  redeem_reward({ p_user_id, p_reward_id, p_reward_name, p_cost }) {
    if (typeof p_cost !== 'number' || p_cost <= 0) return { ok: false, reason: 'bad_cost' };
    const econ = table('user_economy').find((r) => r.user_id === p_user_id);
    if (!econ) return { ok: false, reason: 'no_row', coins: 0 }; // khớp reward_redemptions.sql (coins:0)
    if (econ.coins < p_cost) return { ok: false, reason: 'insufficient', coins: econ.coins };
    econ.coins -= p_cost;
    const id = nextId('redemption');
    table('reward_redemptions').push({
      id,
      user_id: p_user_id,
      reward_id: p_reward_id,
      reward_name: p_reward_name,
      cost_coins: p_cost,
      status: 'pending',
      created_at: new Date(state.idCounter * 1000).toISOString(),
      fulfilled_at: null,
    });
    return { ok: true, reason: 'ok', coins: econ.coins, redemptionId: id };
  },

  confirm_payment({ p_order_id, p_gateway_txn_id, p_amount }) {
    const txn = table('payment_transactions').find((r) => r.order_id === p_order_id);
    if (!txn) return { ok: false, reason: 'not_found' };
    const meta = { userId: txn.user_id, tier: txn.tier, period: txn.period };
    // Kiểm tiền: p_amount > 0 và lệch → amount_mismatch (KHÔNG cấp).
    if (p_amount > 0 && p_amount !== txn.amount_vnd) {
      return { ok: false, reason: 'amount_mismatch', ...meta };
    }
    // Đã 'paid' → idempotent, KHÔNG cấp lại (return TRƯỚC insert → chống double-grant).
    if (txn.status === 'paid') {
      return { ok: true, alreadyConfirmed: true, ...meta };
    }
    // Chỉ lật từ 'pending'.
    if (txn.status !== 'pending') {
      return { ok: false, reason: 'bad_status', ...meta };
    }
    txn.status = 'paid';
    txn.gateway_txn_id = p_gateway_txn_id || null;
    txn.paid_at = new Date(state.idCounter * 1000).toISOString();
    // 🔴 A2: CẤP GÓI NGUYÊN TỬ — mô phỏng INSERT user_subscriptions CÙNG transaction
    // với UPDATE status='paid' (SQL thật dùng now() + duration_days days). CHỈ chạy
    // trên nhánh lật pending→paid (nhánh alreadyConfirmed đã return ở trên) → đúng
    // 1 dòng/order dù IPN gọi nhiều lần. Đơn cũ thiếu duration_days (null) → BỎ QUA
    // insert (giữ tương thích), khớp nhánh `if v_duration is not null` của RPC.
    if (txn.duration_days != null && txn.duration_days > 0) {
      const startedAt = new Date(state.idCounter * 1000).toISOString();
      const expiresAt = new Date(
        state.idCounter * 1000 + txn.duration_days * 86400 * 1000
      ).toISOString();
      table('user_subscriptions').push({
        id: nextId('user_subscriptions'),
        user_id: txn.user_id,
        tier: txn.tier,
        period: txn.period,
        started_at: startedAt,
        expires_at: expiresAt,
        created_at: startedAt,
      });
    }
    return { ok: true, alreadyConfirmed: false, ...meta };
  },

  fulfill_redemption({ p_redemption_id }) {
    const rec = table('reward_redemptions').find((r) => r.id === p_redemption_id);
    if (!rec) return { ok: false, reason: 'not_found' };
    if (rec.status === 'fulfilled') return { ok: true, reason: 'already', status: 'fulfilled' };
    if (rec.status !== 'pending') return { ok: false, reason: 'bad_status', status: rec.status };
    rec.status = 'fulfilled';
    rec.fulfilled_at = new Date(state.idCounter * 1000).toISOString();
    return { ok: true, reason: 'ok', status: 'fulfilled' };
  },

  cancel_redemption({ p_redemption_id }) {
    const rec = table('reward_redemptions').find((r) => r.id === p_redemption_id);
    if (!rec) return { ok: false, reason: 'not_found' };
    if (rec.status === 'cancelled') return { ok: true, reason: 'already', status: 'cancelled' };
    if (rec.status !== 'pending') return { ok: false, reason: 'bad_status', status: rec.status };
    // Hoàn xu + đổi status (atomic trong SQL thật; ở fake single-thread = tuần tự).
    const econ = table('user_economy').find((r) => r.user_id === rec.user_id);
    if (econ) econ.coins += rec.cost_coins;
    rec.status = 'cancelled';
    return { ok: true, reason: 'ok', status: 'cancelled', coins: econ ? econ.coins : undefined };
  },

  consume_pvp_fight({ p_user_id, p_target_rank, p_won, p_today, p_max_fights }) {
    const econ = table('user_economy').find((r) => r.user_id === p_user_id);
    if (!econ) return { ok: false, reason: 'no_row', pvpRank: 0, fightsToday: 0 };
    // reset ngày mới
    if (econ.pvp_last_fight_date !== p_today) {
      econ.pvp_fights_today = 0;
      econ.pvp_last_fight_date = p_today;
    }
    const rank = econ.pvp_rank ?? 11;
    if (p_target_rank !== rank - 1) {
      return { ok: false, reason: 'bad_rank', pvpRank: rank, fightsToday: econ.pvp_fights_today };
    }
    if (econ.pvp_fights_today >= p_max_fights) {
      return { ok: false, reason: 'cap', pvpRank: rank, fightsToday: econ.pvp_fights_today };
    }
    econ.pvp_fights_today += 1;
    if (p_won) econ.pvp_rank = p_target_rank;
    return { ok: true, reason: 'ok', pvpRank: econ.pvp_rank, fightsToday: econ.pvp_fights_today };
  },
};

function execRpc(name, params) {
  if (state.rpcsDisabled.has(name) || !RPCS[name]) {
    // Migration chưa chạy: PostgREST KHÔNG thấy hàm trong schema cache → PGRST202
    // (HTTP 404). Đây là mã PROD thật cho "function does not exist" — không phải
    // 42883 (mã Postgres cho sai-kiểu-tham-số, ít gặp hơn). Store handle CẢ hai.
    return { data: null, error: { code: 'PGRST202', message: `Could not find the function ${name} in the schema cache` } };
  }
  return { data: RPCS[name](params ?? {}), error: null };
}

// ── Client factory (anon + admin dùng chung DB; không mô phỏng RLS) ──────────
export function makeClient() {
  return {
    from(tableName) {
      return makeBuilder(tableName);
    },
    rpc(name, params) {
      return Promise.resolve(execRpc(name, params));
    },
    auth: {
      getUser() {
        if (!state.currentUser) {
          return Promise.resolve({ data: { user: null }, error: { message: 'no session' } });
        }
        return Promise.resolve({ data: { user: { id: state.currentUser.id } }, error: null });
      },
    },
  };
}
