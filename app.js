// Laurels money: reads the DashWeek, DashMonth and EmmaFileId named ranges of
// Laurel's Bills with the signed-in person's own Google access.
(() => {
  // Google only accepts the https address, so never sign in from http.
  if (location.protocol === 'http:' && location.hostname !== 'localhost') {
    location.replace('https://' + location.host + location.pathname + location.search + location.hash);
    return;
  }
  const cfg = window.LAURELS_CONFIG;
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly';
  const TOKEN_KEY = 'lm.token';
  const CACHE_KEY = 'lm.data';
  const SILENT_KEY = 'lm.silentTried';
  const STATE_KEY = 'lm.state';

  const SHORT = {
    'Eating out, takeaways, pubs and entertainment': 'Eating out and entertainment',
    'Everything else not itemised above': 'Everything else',
    'Gifts, donations and school': 'Gifts, donations, school',
  };
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const gbp = (n) => '£' + Math.round(Math.abs(n)).toLocaleString('en-GB');
  const store = {
    get(k, area = localStorage) { try { return JSON.parse(area.getItem(k)); } catch { return null; } },
    set(k, v, area = localStorage) { try { area.setItem(k, JSON.stringify(v)); } catch {} },
    del(k, area = localStorage) { try { area.removeItem(k); } catch {} },
  };

  // ---- Sign-in (OAuth implicit flow by redirect, which works in home-screen apps) ----
  const redirectUri = location.origin + '/';
  const signIn = (silent) => {
    const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
    store.set(STATE_KEY, state, sessionStorage);
    if (silent) store.set(SILENT_KEY, true, sessionStorage);
    const p = new URLSearchParams({
      client_id: cfg.clientId, redirect_uri: redirectUri, response_type: 'token',
      scope: SCOPES, include_granted_scopes: 'true', state,
      prompt: silent ? 'none' : 'select_account',
    });
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p);
  };
  const readRedirect = () => {
    if (!location.hash.includes('=')) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname);
    const expected = store.get(STATE_KEY, sessionStorage);
    store.del(STATE_KEY, sessionStorage);
    if (!expected || p.get('state') !== expected) return { error: 'state' };
    if (p.get('error')) return { error: p.get('error') };
    const token = { value: p.get('access_token'), expires: Date.now() + (Number(p.get('expires_in')) - 60) * 1000 };
    store.set(TOKEN_KEY, token);
    store.del(SILENT_KEY, sessionStorage);
    return { token };
  };
  const validToken = () => { const t = store.get(TOKEN_KEY); return t && t.value && t.expires > Date.now() ? t.value : null; };

  // ---- Data ----
  const toRows = (values) => {
    if (!values || !values.length) return [];
    const cols = values[0];
    return values.slice(1).filter((r) => r[0] !== undefined && r[0] !== '')
      .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] === undefined ? '' : r[i]])));
  };
  const api = async (url, token) => {
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 401) throw Object.assign(new Error('expired'), { code: 401 });
    if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { code: res.status });
    return res.json();
  };
  const fetchData = async (token) => {
    const q = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE' });
    ['DashWeek', 'DashMonth', 'EmmaFileId'].forEach((r) => q.append('ranges', r));
    const sheet = await api(`https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}/values:batchGet?${q}`, token);
    const [week, month, file] = sheet.valueRanges.map((v) => v.values);
    let synced = null;
    const emmaId = file && file[0] && String(file[0][0]).trim();
    if (emmaId) {
      try { synced = (await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(emmaId)}?fields=modifiedTime&supportsAllDrives=true`, token)).modifiedTime; } catch {}
    }
    return { week: toRows(week), month: toRows(month), synced, at: new Date().toISOString() };
  };

  // ---- Drawing ----
  let page = 'week', data = null;
  const show = (p) => {
    page = p;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.page === p)));
    ['week', 'month'].forEach((k) => { $(k).hidden = !data || k !== p; });
  };
  const item = (name, state, leftText, fillPct, pacePct, metaText) => {
    const li = el('li', 'card');
    const row = el('div', 'row');
    row.append(el('span', 'name', SHORT[name] || name), el('span', 'left ' + state, leftText));
    const bar = el('div', 'bar-track');
    const fill = el('div', 'fill ' + state); fill.style.width = Math.max(0, Math.min(fillPct, 100)) + '%';
    bar.append(fill);
    if (pacePct != null) { const p = el('div', 'pace'); p.style.left = 'calc(' + Math.min(pacePct, 100) + '% - 1px)'; bar.append(p); }
    li.append(row, bar, el('div', 'meta', metaText));
    return li;
  };
  const drawWeek = (rows) => {
    const t = rows[rows.length - 1];
    const budget = t.allowance + t.carried_over;
    const d = new Date(t.week_start + 'T12:00:00');
    $('week-kicker').textContent = 'Week starting ' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    $('week-big').textContent = gbp(t.left) + (t.left < 0 ? ' over' : ' left');
    $('week-big').classList.toggle('over', t.left < 0);
    $('week-sub').textContent = 'All weekly budgets together: ' + gbp(t.spent) + ' spent of ' + (budget < 0 ? '−' : '') + gbp(budget) + ' available this week.';
    $('week-carry').hidden = !t.carried_over;
    $('week-carry').textContent = 'That is the ' + gbp(t.allowance) + ' weekly allowance ' + (t.carried_over > 0 ? 'plus ' : 'less ') + gbp(t.carried_over) + (t.carried_over > 0 ? ' saved' : ' overspent') + ' earlier this pay month.';
    const perDay = t.left > 0 && t.days_left > 0 ? t.left / t.days_left : 0;
    $('week-perday').hidden = !perDay;
    $('week-perday').textContent = 'About ' + gbp(perDay) + ' a day for the ' + t.days_left + ' days left, including today.';
    $('week-list').replaceChildren(...rows.slice(0, -1).filter((r) => r.allowance > 0 || r.spent > 0 || r.carried_over).map((r) => {
      const cap = r.allowance + r.carried_over;
      let meta = gbp(r.spent) + ' spent · allowance ' + gbp(r.allowance);
      if (r.carried_over) meta += (r.carried_over > 0 ? ' + ' : ' − ') + gbp(r.carried_over) + (r.carried_over > 0 ? ' saved' : ' overspent') + ' earlier this pay month';
      const leftText = !r.left && cap <= 0 ? 'No budget' : gbp(r.left) + (r.left < 0 ? ' over' : ' left');
      return item(r.line, r.left < 0 ? 'bad' : 'ok', leftText, cap > 0 ? r.spent / cap * 100 : 100, null, meta);
    }));
  };
  const drawMonth = (rows) => {
    const t = rows[rows.length - 1];
    $('month-kicker').textContent = 'Day-to-day spending, pay month ' + t.period;
    $('month-big').textContent = gbp(t.left) + (t.left < 0 ? ' over' : ' left');
    $('month-big').classList.toggle('over', t.left < 0);
    $('month-sub').textContent = gbp(t.spent) + ' spent of ' + gbp(t.target) + ', with ' + t.days_left + ' days to go.';
    const gap = t.spent - t.budget_so_far;
    $('month-pace').textContent = 'By today the budget allows ' + gbp(t.budget_so_far) + ', so you are ' + gbp(gap) + (gap > 0 ? ' over' : ' under') + ' that pace.';
    $('month-list').replaceChildren(...rows.slice(0, -1).filter((r) => r.target > 0 || r.spent > 0).map((r) => {
      if (r.target <= 0) return item(r.line, 'bad', 'No budget', 100, null, gbp(r.spent) + ' spent');
      const state = r.left < 0 ? 'bad' : r.spent > r.budget_so_far ? 'warn' : 'ok';
      return item(r.line, state, gbp(r.left) + (r.left < 0 ? ' over' : ' left'), r.spent / r.target * 100, r.budget_so_far / r.target * 100, gbp(r.spent) + ' spent of ' + gbp(r.target));
    }));
  };
  const draw = () => {
    if (!data) return;
    drawWeek(data.week);
    drawMonth(data.month);
    const when = (iso, opts) => new Date(iso).toLocaleString('en-GB', opts);
    $('updated').textContent = data.synced
      ? 'Emma last synced ' + when(data.synced, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Updated ' + when(data.at, { hour: '2-digit', minute: '2-digit' });
    show(page);
  };
  const message = (text) => { $('msg').hidden = !text; $('msg').textContent = text || ''; };
  const askSignIn = (text) => {
    $('signin').hidden = false;
    if (text) $('signin-text').textContent = text;
  };

  // ---- Flow ----
  let loading = false;
  const load = async ({ interactive = false } = {}) => {
    if (loading) return;
    const token = validToken();
    if (!token) {
      if (interactive || !store.get(SILENT_KEY, sessionStorage)) return signIn(!interactive);
      return askSignIn();
    }
    loading = true; $('refresh').classList.add('spinning');
    try {
      data = await fetchData(token);
      store.set(CACHE_KEY, data);
      $('signin').hidden = true; message('');
      draw();
    } catch (e) {
      if (e.code === 401) { store.del(TOKEN_KEY); store.del(SILENT_KEY, sessionStorage); loading = false; $('refresh').classList.remove('spinning'); return load(); }
      if (e.code === 403 || e.code === 404) askSignIn("This Google account can't open Laurel's Bills. Sign in with one that can.");
      else message("Couldn't reach Google just now. Showing the last figures.");
    } finally {
      loading = false; $('refresh').classList.remove('spinning');
    }
  };

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.page)));
  $('refresh').addEventListener('click', () => load({ interactive: !validToken() }));
  $('signin-button').addEventListener('click', () => signIn(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && validToken()) load(); });

  const back = readRedirect();
  data = store.get(CACHE_KEY);
  draw();
  if (back && back.error) {
    if (back.error !== 'state') store.set(SILENT_KEY, true, sessionStorage);
    askSignIn();
  } else {
    load();
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
