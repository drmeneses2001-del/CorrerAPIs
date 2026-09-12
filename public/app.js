const state = {
  connections: [],
  selectedId: null,
  creating: false,
};

const el = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    showLogin();
    throw new Error('No autenticado');
  }
  return res;
}

function showLogin() {
  el('loginScreen').hidden = false;
  el('mainScreen').hidden = true;
}

function showMain() {
  el('loginScreen').hidden = true;
  el('mainScreen').hidden = false;
}

async function checkSession() {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.authenticated) {
    showMain();
    await loadConnections();
  } else {
    showLogin();
  }
}

el('loginBtn').addEventListener('click', async () => {
  const password = el('loginPassword').value;
  el('loginError').hidden = true;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    el('loginPassword').value = '';
    showMain();
    await loadConnections();
  } else {
    const data = await res.json().catch(() => ({}));
    el('loginError').textContent = data.error || 'No se pudo iniciar sesion';
    el('loginError').hidden = false;
  }
});

el('loginPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el('loginBtn').click();
});

el('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  showLogin();
});

async function loadConnections() {
  const res = await api('/api/connections');
  state.connections = await res.json();
  renderList();
  if (state.selectedId && !state.connections.find((c) => c.id === state.selectedId)) {
    state.selectedId = null;
  }
  renderDetail();
}

function renderList() {
  const list = el('connList');
  list.innerHTML = '';
  state.connections.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'conn-item' + (c.id === state.selectedId ? ' active' : '');
    li.innerHTML = `
      <div class="meta">
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="sub">${escapeHtml(c.model || 'sin modelo')} · ${escapeHtml(c.baseUrl)}</div>
      </div>
      <span class="badge">${c.hasApiKey ? 'key ok' : 'sin key'}</span>
    `;
    li.addEventListener('click', () => selectConnection(c.id));
    list.appendChild(li);
  });
}

function selectConnection(id) {
  state.selectedId = id;
  state.creating = false;
  renderDetail();
}

el('newConnBtn').addEventListener('click', () => {
  state.selectedId = null;
  state.creating = true;
  renderDetail();
});

function renderDetail() {
  renderList();
  const conn = state.connections.find((c) => c.id === state.selectedId);

  if (!conn && !state.creating) {
    el('emptyState').hidden = false;
    el('connForm').hidden = true;
    el('runPanel').hidden = true;
    return;
  }

  el('emptyState').hidden = true;
  el('connForm').hidden = false;

  el('formTitle').textContent = conn ? `Editar: ${conn.name}` : 'Nueva conexion';
  el('fName').value = conn ? conn.name : '';
  el('fModel').value = conn ? conn.model : '';
  el('fBaseUrl').value = conn ? conn.baseUrl : '';
  el('fPath').value = conn ? conn.path : '';
  el('fMethod').value = conn ? conn.method : 'POST';
  el('fAuthHeader').value = conn ? conn.authHeader : 'Authorization';
  el('fAuthScheme').value = conn ? conn.authScheme : 'Bearer ';
  el('fApiKey').value = '';
  el('fApiKeyHint').textContent = conn && conn.apiKeyMasked ? `(actual: ${conn.apiKeyMasked}, deja vacio para no cambiarla)` : '';
  el('deleteConnBtn').hidden = !conn;

  el('runPanel').hidden = !conn;
  el('runResponse').hidden = true;
  el('runResponse').textContent = '';
  el('runMeta').textContent = '';
  if (conn) {
    el('rPath').value = conn.path || '';
  }
}

el('cancelFormBtn').addEventListener('click', () => {
  state.creating = false;
  if (!state.selectedId) {
    el('connForm').hidden = true;
    el('emptyState').hidden = false;
  } else {
    renderDetail();
  }
});

el('saveConnBtn').addEventListener('click', async () => {
  const payload = {
    name: el('fName').value.trim(),
    model: el('fModel').value.trim(),
    baseUrl: el('fBaseUrl').value.trim(),
    path: el('fPath').value.trim(),
    method: el('fMethod').value,
    authHeader: el('fAuthHeader').value.trim() || 'Authorization',
    authScheme: el('fAuthScheme').value,
  };
  const apiKey = el('fApiKey').value;
  if (apiKey) payload.apiKey = apiKey;

  if (!payload.name || !payload.baseUrl) {
    alert('Nombre y URL base son obligatorios');
    return;
  }

  let res;
  if (state.selectedId) {
    res = await api(`/api/connections/${state.selectedId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    res = await api('/api/connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'No se pudo guardar la conexion');
    return;
  }

  const saved = await res.json();
  state.creating = false;
  state.selectedId = saved.id;
  await loadConnections();
});

el('deleteConnBtn').addEventListener('click', async () => {
  if (!state.selectedId) return;
  if (!confirm('Eliminar esta conexion? Esta accion no se puede deshacer.')) return;
  const res = await api(`/api/connections/${state.selectedId}`, { method: 'DELETE' });
  if (res.ok || res.status === 204) {
    state.selectedId = null;
    await loadConnections();
  }
});

el('runBtn').addEventListener('click', async () => {
  if (!state.selectedId) return;
  let body;
  try {
    const raw = el('rBody').value.trim();
    body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    alert('El body no es JSON valido: ' + err.message);
    return;
  }

  const payload = {
    path: el('rPath').value.trim(),
    injectModel: el('rInjectModel').checked,
    body,
  };

  el('runBtn').disabled = true;
  el('runMeta').textContent = 'Ejecutando...';
  el('runResponse').hidden = true;

  try {
    const res = await api(`/api/run/${state.selectedId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    el('runMeta').innerHTML = res.ok
      ? `<span class="status-ok">HTTP ${data.status}</span>`
      : `<span class="status-err">Error (HTTP ${res.status})</span>`;
    el('runResponse').hidden = false;
    el('runResponse').textContent = JSON.stringify(data.data !== undefined ? data.data : data, null, 2);
  } catch (err) {
    el('runMeta').innerHTML = `<span class="status-err">${escapeHtml(err.message)}</span>`;
  } finally {
    el('runBtn').disabled = false;
  }
});

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

checkSession();
