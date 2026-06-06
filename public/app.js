(function () {
  const pageUrl = "https://ideal-broccoli-7x595pwggj92pj76.github.dev";
  document.getElementById("wa-share")?.addEventListener("click", function () {
    window.location.href = "https://wa.me/?text=" + encodeURIComponent(pageUrl);
  });
})();

// ==========================================
// STATE
// ==========================================
let state = {
  assets: [],
  owners: {},
  rows: [],
  cellData: {},
  towers: ['PTP', 'RTR', 'OTC', 'FP&A'],
  regions: ['APAC', 'EMEA', 'Americas'],
  initiativeTypes: [],
  customInsights: []
};

let activeTab = 'tab-input';
let currentEditingCell = null;
let selectedPopoverStatus = 'Not Applicable';
let previousInputValues = {};
let lastServerSyncStr = "";

// Active filter state (shared across both tabs)
let filterState = { region: '', tower: '', assessment: '', initiative: '' };

// Sort state
let sortState = { col: null, dir: null };

// Sortable columns config: { key, label }
const SORTABLE_COLS = [
  { key: 'client', label: 'Client Name' },
  { key: 'region', label: 'Region' },
  { key: 'tower', label: 'Tower' },
  { key: 'baseFte', label: 'Baseline FTE' },
  { key: 'assessment', label: 'Assessment Status' },
  { key: 'pipelineFte', label: 'Agentic Potential FTE' },
  { key: 'decision', label: 'Client Approval for AI' },
  { key: 'initiative', label: 'Proposed Asset' },
  { key: 'initiativeType', label: 'Type' },
  { key: 'estimatedFteBenefit', label: 'Est. FTE Benefit' },
  { key: 'implementationCost', label: 'Impl. Cost ($)' },
  { key: 'dollarSavings', label: '$ Savings' },
  { key: '_remaining', label: 'Remaining Pot.' },
  { key: 'owner', label: 'Owner' },
  { key: '_actualPct', label: 'Release %' },
  { key: 'benchmark', label: 'Benchmark %' },
  { key: '_variance', label: 'Variance %' },
];

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadData();

  document.getElementById('saveBtn').addEventListener('click', saveData);
  document.getElementById('downloadXlsBtn').addEventListener('click', downloadXls);
  document.getElementById('downloadPptBtn').addEventListener('click', downloadPpt);
  document.getElementById('bulkUploadBtn').addEventListener('click', () => {
    document.getElementById('bulkUploadInput').click();
  });
  document.getElementById('bulkUploadInput').addEventListener('change', handleBulkUpload);

  // Close popover on outside click
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('cellPopover');
    if (popover.classList.contains('active') &&
      !popover.contains(e.target) &&
      !e.target.classList.contains('asset-cell')) {
      closePopover();
    }
    // Hide suggestion dropdowns
    if (!e.target.classList.contains('initiative-input')) {
      document.querySelectorAll('.initiative-suggestions').forEach(s => s.style.display = 'none');
    }
  });

  document.getElementById('popoverFte').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSavePopover();
  });

  // Start automatic polling every 5 seconds
  setInterval(pollServer, 5000);
});

function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      document.getElementById(activeTab).classList.add('active');
      closePopover();
      if (activeTab === 'tab-insights') renderInsights();
      else if (activeTab === 'tab-assets') renderAssetGrid();
      else renderInputTable();
    });
  });
}

// ==========================================
// DATA LOAD / SAVE
// ==========================================
async function loadData() {
  try {
    const res = await fetch('/api/data?_cb=' + Date.now());
    const loaded = await res.json();
    state = loaded;
    if (!state.assets) state.assets = [];
    if (!state.owners) state.owners = {};
    if (!state.rows) state.rows = [];
    if (!state.cellData) state.cellData = {};
    if (!state.towers || state.towers.length === 0) state.towers = ['PTP', 'RTR', 'OTC', 'FP&A'];
    if (!state.regions || state.regions.length === 0) state.regions = ['APAC', 'EMEA', 'Americas'];
    if (!state.initiativeTypes) state.initiativeTypes = [];
    if (!state.customInsights) state.customInsights = [];

    state.rows.forEach(row => {
      if (row.pipelineFte === undefined) row.pipelineFte = 0;
      if (row.estimatedFteBenefit === undefined) row.estimatedFteBenefit = 0;
      if (row.implementationCost === undefined) row.implementationCost = 0;
      if (row.dollarSavings === undefined) row.dollarSavings = 0;
      if (!row.owner) row.owner = 'None';
      if (!row.region) row.region = '';
      if (row.decision === 'Pending Review') row.decision = '';
      if (!row.initiativeType) row.initiativeType = '';
    });

    lastServerSyncStr = JSON.stringify({ rows: state.rows, cellData: state.cellData, assets: state.assets, owners: state.owners, towers: state.towers, regions: state.regions, initiativeTypes: state.initiativeTypes, customInsights: state.customInsights });

    showStatus('Connected & Synced', 'success');
    renderInputTable();
  } catch (err) {
    console.error('Load error:', err);
    showStatus('Offline Mode (Local Storage)', 'warning');
    const local = localStorage.getItem('ai_penetration_state');
    if (local) { state = JSON.parse(local); renderInputTable(); }
  }
}

async function saveData() {
  showStatus('Saving...', 'saving');
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (res.ok) {
      showStatus('Saved & Synced', 'success');
      localStorage.setItem('ai_penetration_state', JSON.stringify(state));
      lastServerSyncStr = JSON.stringify({ rows: state.rows, cellData: state.cellData, assets: state.assets, owners: state.owners, towers: state.towers, regions: state.regions, initiativeTypes: state.initiativeTypes, customInsights: state.customInsights });
      downloadJsonState();
    } else throw new Error();
  } catch {
    showStatus('Failed to save', 'error');
    localStorage.setItem('ai_penetration_state', JSON.stringify(state));
  }
}

async function pollServer() {
  if (document.hidden) return;
  const isEditing = document.activeElement && 
                    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') ||
                    document.getElementById('cellPopover').classList.contains('active');
  if (isEditing) return;

  try {
    const res = await fetch('/api/data?_cb=' + Date.now());
    if (!res.ok) return;
    const loaded = await res.json();
    const loadedStr = JSON.stringify({ rows: loaded.rows, cellData: loaded.cellData, assets: loaded.assets, owners: loaded.owners, towers: loaded.towers, regions: loaded.regions, initiativeTypes: loaded.initiativeTypes, customInsights: loaded.customInsights });
    
    if (loadedStr !== lastServerSyncStr) {
      state = loaded;
      lastServerSyncStr = loadedStr;
      if (activeTab === 'tab-insights') renderInsights();
      else if (activeTab === 'tab-assets') renderAssetGrid();
      else renderInputTable();
      showStatus('Connected & Synced', 'success');
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

function showStatus(text, type) {
  const el = document.getElementById('syncStatus');
  el.textContent = text;
  el.style.backgroundColor = type === 'success' ? '#e2efda' : type === 'error' ? '#fce4d6' : '#fff2cc';
  el.style.color = type === 'success' ? '#375623' : type === 'error' ? '#c00000' : '#7f6000';
}

// ==========================================
// HELPERS
// ==========================================
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isAssessmentActive(a) {
  return a === 'In Progress' || a === 'Completed';
}

function getTowerBenchmark(tower) {
  const l = tower.toLowerCase();
  if (l.includes('ptp')) return 25;
  if (l.includes('rtr')) return 15;
  if (l.includes('otc')) return 20;
  if (l.includes('fpna') || l.includes('fp&a') || l.includes('fp&amp;a')) return 30;
  return 20;
}

function getDecisionColorClass(d) {
  if (d === 'Deployed') return 'status-deployed';
  if (d === 'Potential but lack CBA') return 'status-potential';
  if (d === 'In progress') return 'status-inprogress';
  if (d === 'Awaiting client approvals') return 'status-awaiting';
  if (d === 'Not Applicable') return 'status-na';
  return '';
}

function getCellStatusClass(s) {
  if (s === 'Deployed') return 'deployed';
  if (s === 'Potential but lack CBA') return 'potential';
  if (s === 'In progress') return 'inprogress';
  if (s === 'Awaiting client approvals') return 'awaiting';
  return 'na';
}

function getUniqueClientCount(excludeRowId, proposedClient) {
  const s = new Set();
  state.rows.forEach(r => {
    const name = r.id === excludeRowId ? (proposedClient || '').trim() : r.client.trim();
    if (name) s.add(name);
  });
  return s.size;
}

function getTowerCountForClient(clientName, excludeRowId, proposedClient) {
  let count = 0;
  state.rows.forEach(r => {
    const rClient = r.id === excludeRowId ? (proposedClient || '').trim() : r.client.trim();
    if (rClient.toLowerCase() === clientName.trim().toLowerCase()) count++;
  });
  return count;
}

function savePrev(key, val) { previousInputValues[key] = val; }

function isDuplicateRow(rowId, client, tower, region, initiative) {
  const c = (client || '').trim().toLowerCase();
  const t = (tower || '').trim().toLowerCase();
  const r = (region || '').trim().toLowerCase();
  const i = (initiative || '').trim().toLowerCase();

  return state.rows.some(row => {
    if (row.id === rowId) return false;
    const rowC = (row.client || '').trim().toLowerCase();
    const rowT = (row.tower || '').trim().toLowerCase();
    const rowR = (row.region || '').trim().toLowerCase();
    const rowI = (row.initiative || '').trim().toLowerCase();
    return rowC === c && rowT === t && rowR === r && rowI === i;
  });
}

function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}-${minutes}-${seconds}`,
    dateTime: `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
  };
}

function downloadJsonState() {
  const dt = getFormattedDateTime();
  const filename = `AI_Penetration_Data_${dt.date}.json`;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleRegionChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  if (isDuplicateRow(rowId, row.client, row.tower, value, row.initiative)) {
    alert(`Duplicate Row Warning: A row with the same Client ("${row.client}"), Tower ("${row.tower}"), Region ("${value || 'None'}"), and Proposed Initiative ("${row.initiative || 'None'}") already exists.`);
    renderInputTable();
    return;
  }
  row.region = value;
  updateFilterDropdowns();
  renderInputTable();
}

// ==========================================
// FILTER STATE & FUNCTIONS
// ==========================================
function updateFilterDropdowns() {
  // Populate both sets of filter dropdowns (input + asset grid)
  ['', '-grid'].forEach(sfx => {
    const rSel = document.getElementById(`filter-region${sfx}`);
    const tSel = document.getElementById(`filter-tower${sfx}`);
    const iSel = document.getElementById(`filter-initiative${sfx}`);
    if (!rSel || !tSel || !iSel) return;

    // Regions
    const curR = rSel.value;
    rSel.innerHTML = '<option value="">All Regions</option>';
    state.regions.forEach(r => {
      const o = document.createElement('option');
      o.value = r; o.textContent = r;
      if (r === curR) o.selected = true;
      rSel.appendChild(o);
    });

    // Towers from master list
    const curT = tSel.value;
    tSel.innerHTML = '<option value="">All Towers</option>';
    state.towers.forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      if (t === curT) o.selected = true;
      tSel.appendChild(o);
    });

    // Assets from master list
    const curI = iSel.value;
    iSel.innerHTML = '<option value="">Asset</option>';
    state.assets.forEach(i => {
      const o = document.createElement('option');
      o.value = i; o.textContent = i;
      if (i === curI) o.selected = true;
      iSel.appendChild(o);
    });
  });
}

function getActiveFilters() {
  // Read from whichever filter bar is active
  const sfx = activeTab === 'tab-assets' ? '-grid' : '';
  return {
    region: (document.getElementById(`filter-region${sfx}`) || {}).value || '',
    tower: (document.getElementById(`filter-tower${sfx}`) || {}).value || '',
    assessment: (document.getElementById(`filter-assessment${sfx}`) || {}).value || '',
    initiative: (document.getElementById(`filter-initiative${sfx}`) || {}).value || '',
  };
}

function applyFilters() {
  // Sync both filter bars when either changes
  ['', '-grid'].forEach(sfx => {
    const rSel = document.getElementById(`filter-region${sfx}`);
    const tSel = document.getElementById(`filter-tower${sfx}`);
    const aSel = document.getElementById(`filter-assessment${sfx}`);
    const iSel = document.getElementById(`filter-initiative${sfx}`);
    if (!rSel) return;
    rSel.value = filterState.region;
    tSel.value = filterState.tower;
    aSel.value = filterState.assessment;
    iSel.value = filterState.initiative;
  });

  // Read the active tab's filters
  const f = getActiveFilters();
  filterState = { ...f };

  if (activeTab === 'tab-input') renderInputTable();
  else if (activeTab === 'tab-assets') renderAssetGrid();
}

function clearFilters() {
  filterState = { region: '', tower: '', assessment: '', initiative: '' };
  ['', '-grid'].forEach(sfx => {
    ['filter-region', 'filter-tower', 'filter-assessment', 'filter-initiative'].forEach(id => {
      const el = document.getElementById(`${id}${sfx}`);
      if (el) el.value = '';
    });
  });
  if (activeTab === 'tab-input') renderInputTable();
  else renderAssetGrid();
}

function getFilteredRows() {
  const f = filterState;
  return state.rows.filter(row => {
    if (f.region && row.region !== f.region) return false;
    if (f.tower && row.tower !== f.tower) return false;
    if (f.assessment && row.assessment !== f.assessment) return false;
    if (f.initiative && row.initiative !== f.initiative) return false;
    return true;
  });
}

// ==========================================
// SORTING
// ==========================================
function handleSort(col) {
  if (sortState.col === col) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : sortState.dir === 'desc' ? null : 'asc';
    if (sortState.dir === null) sortState.col = null;
  } else {
    sortState.col = col;
    sortState.dir = 'asc';
  }
  renderInputTable();
}

function getSortedRows() {
  // 1. Apply active filters
  let rows = getFilteredRows();

  // 2. Sort
  if (!sortState.col || !sortState.dir) return rows;

  return [...rows].sort((a, b) => {
    let va, vb;
    if (sortState.col === '_remaining') {
      va = (a.pipelineFte || 0) - (a.estimatedFteBenefit || 0);
      vb = (b.pipelineFte || 0) - (b.estimatedFteBenefit || 0);
    } else if (sortState.col === '_actualPct') {
      va = a.baseFte > 0 ? a.pipelineFte / a.baseFte : 0;
      vb = b.baseFte > 0 ? b.pipelineFte / b.baseFte : 0;
    } else if (sortState.col === '_variance') {
      va = (a.baseFte > 0 ? a.pipelineFte / a.baseFte : 0) - (a.benchmark || 0) / 100;
      vb = (b.baseFte > 0 ? b.pipelineFte / b.baseFte : 0) - (b.benchmark || 0) / 100;
    } else {
      va = a[sortState.col] ?? '';
      vb = b[sortState.col] ?? '';
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortState.dir === 'asc' ? va - vb : vb - va;
    }
    return sortState.dir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });
}

// ==========================================
// RENDER TABLE HEADER (with sort arrows)
// ==========================================
function renderInputTableHeader() {
  const tr = document.getElementById('inputTableHead');
  tr.innerHTML = '';

  const sortableCols = new Set([
    'client', 'region', 'tower', 'decision', 'initiative', 'estimatedFteBenefit', 'owner'
  ]);

  SORTABLE_COLS.forEach(col => {
    const th = document.createElement('th');
    th.style.whiteSpace = 'nowrap';
    if (col.key === 'tower') th.style.minWidth = '90px';
    if (col.key === 'region') th.style.minWidth = '72px';
    const isSortable = sortableCols.has(col.key);
    const isActive = sortState.col === col.key;
    const arrow = isActive ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
    th.innerHTML = isSortable
      ? `<span class="sort-header" onclick="handleSort('${col.key}')" title="Sort by ${col.label}">${escHtml(col.label)}${arrow}</span>`
      : escHtml(col.label);
    if (isActive) th.classList.add('sort-active');
    tr.appendChild(th);
  });

  const thAct = document.createElement('th');
  thAct.style.width = '50px';
  thAct.textContent = 'Action';
  tr.appendChild(thAct);
}

// ==========================================
// RENDER TAB 1: INPUT TABLE
// ==========================================
function renderInputTable() {
  renderInputTableHeader();
  updateFilterDropdowns();

  const tbody = document.getElementById('inputTableBody');
  tbody.innerHTML = '';

  let totalBaseline = 0, totalPipeline = 0, totalSavings = 0, totalCost = 0;

  const rows = getSortedRows();

  // Filter count display
  const countEl = document.getElementById('filterCount');
  const isFiltered = Object.values(filterState).some(v => v !== '');
  if (countEl) { countEl.textContent = isFiltered ? `${rows.length} of ${state.rows.length} rows` : ''; countEl.style.color = isFiltered ? '#c62828' : ''; }

  rows.forEach(row => {
    const rowId = row.id;
    const active = isAssessmentActive(row.assessment);
    const remainingPotential = (row.pipelineFte || 0) - (row.estimatedFteBenefit || 0);

    totalBaseline += parseFloat(row.baseFte || 0);
    totalPipeline += parseFloat(row.pipelineFte || 0);
    totalSavings += parseFloat(row.dollarSavings || 0);
    totalCost += parseFloat(row.implementationCost || 0);

    const actualPct = row.baseFte > 0 ? (row.pipelineFte / row.baseFte) : 0;
    const benchmarkPct = (row.benchmark || 0) / 100;
    const variance = actualPct - benchmarkPct;
    const savingsVal = parseFloat(row.dollarSavings || 0);

    // Owner dropdown
    let ownerOpts = `<option value="None" ${row.owner === 'None' || !row.owner ? 'selected' : ''}>None</option>`;
    Object.keys(state.owners).forEach(n => {
      ownerOpts += `<option value="${escHtml(n)}" ${row.owner === n ? 'selected' : ''}>${escHtml(n)}</option>`;
    });

    // Mail link
    const ownerEmail = state.owners[row.owner] || '';
    let emailAnchor = '';
    if (ownerEmail) {
      const subj = encodeURIComponent(`AI Penetration Status - ${row.client} ${row.tower}`);
      const body = encodeURIComponent(`Hi ${row.owner},\n\nStatus update for ${row.client} - ${row.tower}.\nBaseline FTE: ${row.baseFte}\nAgentic Potential: ${row.pipelineFte}\nInitiative: ${row.initiative || 'None'}\n\nRegards`);
      emailAnchor = `<a href="mailto:${ownerEmail}?subject=${subj}&body=${body}" class="email-link-btn" title="Email ${row.owner}">✉</a>`;
    }

    // Tower dropdown
    const towerOpts = state.towers.map(t =>
      `<option value="${escHtml(t)}" ${row.tower === t ? 'selected' : ''}>${escHtml(t)}</option>`
    ).join('');

    // Region dropdown
    const regionOpts = `<option value="" ${!row.region ? 'selected' : ''}>-- Select --</option>` +
      state.regions.map(r =>
        `<option value="${escHtml(r)}" ${row.region === r ? 'selected' : ''}>${escHtml(r)}</option>`
      ).join('');

    // Client Approval options
    const decisionOpts = ['', 'Deployed', 'Potential but lack CBA', 'In progress', 'Awaiting client approvals', 'Not Applicable'].map(v =>
      `<option value="${v}" ${row.decision === v ? 'selected' : ''}>${v === '' ? 'Select' : v}</option>`
    ).join('');

    // Initiative Type dropdown
    const typeOpts = [`<option value="" ${!row.initiativeType ? 'selected' : ''}>-- Select --</option>`,
    ...state.initiativeTypes.map(t => `<option value="${escHtml(t)}" ${row.initiativeType === t ? 'selected' : ''}>${escHtml(t)}</option>`)
    ].join('');

    const dis = active ? '' : 'disabled';

    // Savings color inline style
    const savCol = savingsVal < 0 ? 'color:#c62828;font-weight:700;' : savingsVal > 0 ? 'color:#2e7d32;font-weight:700;' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="editable-cell-input" value="${escHtml(row.client)}"
          onfocus="savePrev('${rowId}::client', this.value)"
          onchange="handleRowInputChange('${rowId}', 'client', this)">
      </td>
      <td>
        <select onchange="handleRegionChange('${rowId}', this.value)">
          ${regionOpts}
        </select>
      </td>
      <td>
        <select onchange="handleTowerChange('${rowId}', this.value)">
          ${towerOpts}
        </select>
      </td>
      <td>
        <input type="number" min="0" step="1" value="${row.baseFte}"
          onchange="handleBaseFteChange('${rowId}', this)" style="width:48px;">
      </td>
      <td>
        <select onchange="handleAssessmentChange('${rowId}', this.value)">
          <option value="Not Started" ${row.assessment === 'Not Started' ? 'selected' : ''}>Not Started</option>
          <option value="In Progress" ${row.assessment === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Completed"   ${row.assessment === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="No Scale"    ${row.assessment === 'No Scale' ? 'selected' : ''}>No Scale</option>
        </select>
      </td>
      <td>
        <input type="number" min="0" step="1" value="${row.pipelineFte || 0}"
          onchange="handlePipelineFteChange('${rowId}', this)" style="width:50px;" ${dis}>
      </td>
      <td>
        <select class="decision-select ${getDecisionColorClass(row.decision)}"
          onchange="handleDecisionDropdownChange('${rowId}', this.value)">
          ${decisionOpts}
        </select>
      </td>
      <td style="position:relative;">
        <input type="text" class="editable-cell-input initiative-input" id="init-input-${rowId}"
          value="${escHtml(row.initiative || '')}" autocomplete="off"
          onfocus="savePrev('${rowId}::initiative', this.value); showInitiativeSuggestions('${rowId}', this)"
          oninput="filterInitiativeSuggestions('${rowId}', this.value)"
          onchange="handleInitiativeInputChange('${rowId}', this.value)"
          ${dis} placeholder="Type or select asset">
        <div class="initiative-suggestions" id="sugg-${rowId}" style="display:none;"></div>
      </td>
      <td>
        <select ${dis} onchange="updateRowField('${rowId}', 'initiativeType', this.value)">
          ${typeOpts}
        </select>
      </td>
      <td>
        <input type="number" min="0" step="0.5" value="${row.estimatedFteBenefit || 0}"
          onchange="handleFteBenefitChange('${rowId}', this.value)" style="width:55px;" ${dis}>
      </td>
      <td>
        <input type="number" min="0" value="${row.implementationCost || 0}"
          onchange="updateRowField('${rowId}', 'implementationCost', parseFloat(this.value)||0)" style="width:70px;" ${dis}>
      </td>
      <td>
        <input type="number" value="${row.dollarSavings || 0}" style="width:75px;${savCol}"
          onchange="handleSavingsChange('${rowId}', this)" ${dis}>
      </td>
      <td class="col-num" style="font-weight:600;">${remainingPotential}</td>
      <td>
        <div class="owner-cell-container">
          <select onchange="updateRowField('${rowId}', 'owner', this.value)">${ownerOpts}</select>
          ${emailAnchor}
        </div>
      </td>
      <td class="col-num">${(actualPct * 100).toFixed(1)}%</td>
      <td>
        <input type="number" min="0" max="100" value="${row.benchmark || 20}"
          onchange="updateRowField('${rowId}', 'benchmark', parseFloat(this.value)||0)" style="width:45px;" ${dis}>%
      </td>
      <td class="col-num ${variance >= 0 ? 'val-positive' : 'val-negative'}">
        ${variance >= 0 ? '+' : ''}${(variance * 100).toFixed(1)}%
      </td>
      <td class="col-center">
        <button class="btn btn-sm btn-danger" onclick="handleDeleteRow('${rowId}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Grey out disabled inputs via JS (to override CSS specificity)
    if (!active) {
      tr.querySelectorAll('input[disabled], select[disabled]').forEach(el => {
        el.style.background = '#f0f0f0';
        el.style.color = '#aaa';
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.55';
      });
    }

    // Re-apply savings color
    const savInput = tr.querySelector(`input[onchange*="handleSavingsChange"]`);
    if (savInput) {
      savInput.style.color = savingsVal < 0 ? '#c62828' : savingsVal > 0 ? '#2e7d32' : '';
      savInput.style.fontWeight = savingsVal !== 0 ? '700' : '';
    }
  });

  // Totals footer
  const tfoot = document.getElementById('inputTableTotals');
  const savCol = totalSavings < 0 ? 'color:#c62828;' : totalSavings > 0 ? 'color:#2e7d32;' : '';
  tfoot.innerHTML = `
    <td colspan="2">TOTAL PORTFOLIO</td>
    <td class="col-num">${totalBaseline}</td>
    <td></td>
    <td class="col-num">${totalPipeline}</td>
    <td colspan="4"></td>
    <td class="col-num">$${totalCost.toLocaleString()}</td>
    <td class="col-num" style="${savCol}">$${totalSavings.toLocaleString()}</td>
    <td colspan="2"></td>
    <td class="col-num">${totalBaseline > 0 ? ((totalPipeline / totalBaseline) * 100).toFixed(1) : '0.0'}%</td>
    <td colspan="2"></td>
    <td></td>
  `;
}

// ==========================================
// INPUT CHANGE HANDLERS
// ==========================================
function handleRowInputChange(rowId, field, inputEl) {
  const proposed = inputEl.value;
  const prev = previousInputValues[`${rowId}::${field}`] || '';
  if (!validateRowUpdate(rowId, field, proposed)) {
    inputEl.value = prev;
    return;
  }
  const row = state.rows.find(r => r.id === rowId);
  if (row) {
    row[field] = proposed.trim();
    if (field === 'tower' && !row.benchmark) row.benchmark = getTowerBenchmark(proposed);
  }
  renderInputTable();
}

function validateRowUpdate(rowId, field, val) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return false;
  val = val.trim();

  if (field === 'client') {
    if (!val) { alert('Client name cannot be blank.'); return false; }
    if (getUniqueClientCount(rowId, val) > 500) { alert('Max 500 unique clients reached.'); return false; }
    if (getTowerCountForClient(val, rowId, val) > 8) { alert(`Client "${val}" already has 8 towers (maximum).`); return false; }
    if (isDuplicateRow(rowId, val, row.tower, row.region, row.initiative)) {
      alert(`Duplicate Row Warning: A row with the same Client ("${val}"), Tower ("${row.tower}"), Region ("${row.region || 'None'}"), and Proposed Initiative ("${row.initiative || 'None'}") already exists.`);
      return false;
    }
  }
  return true;
}

function handleTowerChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  if (isDuplicateRow(rowId, row.client, value, row.region, row.initiative)) {
    alert(`Duplicate Row Warning: A row with the same Client ("${row.client}"), Tower ("${value}"), Region ("${row.region || 'None'}"), and Proposed Initiative ("${row.initiative || 'None'}") already exists.`);
    renderInputTable(); // revert display
    return;
  }
  row.tower = value;
  if (!row.benchmark) row.benchmark = getTowerBenchmark(value);
  renderInputTable();
}

function handleBaseFteChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  let val = parseInt(input.value, 10);
  if (isNaN(val) || val < 0) {
    alert('Baseline FTE must be a whole number ≥ 0.');
    input.value = row.baseFte;
    return;
  }
  if (val < (row.pipelineFte || 0)) {
    alert(`Baseline FTE (${val}) cannot be less than Agentic Potential FTE (${row.pipelineFte}). Please reduce Agentic Potential FTE first.`);
    input.value = row.baseFte;
    return;
  }
  row.baseFte = val;
  renderInputTable();
}

function handlePipelineFteChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  let val = parseFloat(input.value) || 0;
  if (val < 0) { alert('Agentic Potential FTE cannot be negative.'); input.value = row.pipelineFte || 0; return; }
  if (val > row.baseFte) {
    alert(`Agentic Potential FTE (${val}) cannot exceed Baseline FTE (${row.baseFte}).`);
    input.value = row.pipelineFte || 0;
    return;
  }
  row.pipelineFte = val;
  renderInputTable();
}

function handleAssessmentChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (row) row.assessment = value;
  renderInputTable();
}

function updateRowField(rowId, field, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (row) row[field] = value;
  renderInputTable();
}

function handleSavingsChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const val = parseFloat(input.value) || 0;
  row.dollarSavings = val;
  // Color
  input.style.color = val < 0 ? '#c62828' : val > 0 ? '#2e7d32' : '';
  input.style.fontWeight = val !== 0 ? '700' : '';
}

function handleDecisionDropdownChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  row.decision = value;
  if (row.initiative) {
    const cellId = `${rowId}::${row.initiative}`;
    if (!state.cellData[cellId]) state.cellData[cellId] = { fte: row.estimatedFteBenefit || 0, status: 'Not Applicable' };
    if (value) state.cellData[cellId].status = value;
  }
  renderInputTable();
}

function handleFteBenefitChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const fteNum = parseFloat(value) || 0;
  row.estimatedFteBenefit = fteNum;
  if (row.initiative) {
    const cellId = `${rowId}::${row.initiative}`;
    if (!state.cellData[cellId]) state.cellData[cellId] = { fte: 0, status: row.decision || 'Not Applicable' };
    state.cellData[cellId].fte = fteNum;
  }
  renderInputTable();
}

// ==========================================
// INITIATIVE AUTOCOMPLETE
// ==========================================
function showInitiativeSuggestions(rowId, inputEl) {
  filterInitiativeSuggestions(rowId, inputEl.value);
}

function filterInitiativeSuggestions(rowId, query) {
  const el = document.getElementById(`sugg-${rowId}`);
  if (!el) return;
  const q = (query || '').toLowerCase();
  const matches = state.assets.filter(a => a.toLowerCase().includes(q));
  if (!matches.length) { el.style.display = 'none'; return; }
  el.innerHTML = matches.map(a =>
    `<div class="sugg-item" onmousedown="selectInitiative('${rowId}','${escHtml(a)}')">${escHtml(a)}</div>`
  ).join('');
  el.style.display = 'block';
}

function selectInitiative(rowId, asset) {
  const input = document.getElementById(`init-input-${rowId}`);
  if (input) { input.value = asset; }
  const el = document.getElementById(`sugg-${rowId}`);
  if (el) el.style.display = 'none';
  handleInitiativeInputChange(rowId, asset);
}

function handleInitiativeInputChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const prevKey = `${rowId}::initiative`;
  const prev = previousInputValues[prevKey] || '';
  const newVal = (value || '').trim();

  const el = document.getElementById(`sugg-${rowId}`);
  if (el) el.style.display = 'none';

  if (newVal === prev) return;

  if (isDuplicateRow(rowId, row.client, row.tower, row.region, newVal)) {
    alert(`Duplicate Row Warning: A row with the same Client ("${row.client}"), Tower ("${row.tower}"), Region ("${row.region || 'None'}"), and Proposed Initiative ("${newVal || 'None'}") already exists.`);
    const inp = document.getElementById(`init-input-${rowId}`);
    if (inp) inp.value = prev;
    renderInputTable();
    return;
  }

  if (newVal && !state.assets.includes(newVal)) {
    if (state.assets.length >= 100) {
      alert('Max 100 assets reached.');
      const inp = document.getElementById(`init-input-${rowId}`);
      if (inp) inp.value = prev;
      return;
    }
    state.assets.push(newVal);
  }

  // Migrate cell data
  if (prev) {
    const oldId = `${rowId}::${prev}`;
    if (state.cellData[oldId]) {
      if (newVal) state.cellData[`${rowId}::${newVal}`] = state.cellData[oldId];
      delete state.cellData[oldId];
    }
  }

  row.initiative = newVal;

  if (newVal) {
    const cellId = `${rowId}::${newVal}`;
    if (!state.cellData[cellId]) {
      state.cellData[cellId] = { fte: row.estimatedFteBenefit || 0, status: row.decision || 'Not Applicable' };
    } else if (state.cellData[cellId].fte > 0) {
      row.estimatedFteBenefit = state.cellData[cellId].fte;
    }
  }

  renderInputTable();
}

// ==========================================
// ADD / DELETE ROW
// ==========================================
function handleAddRow() {
  const uniqueCount = getUniqueClientCount();
  let clientName = 'New Client';
  let idx = 1;
  while (getTowerCountForClient(clientName) >= 8) {
    clientName = `New Client ${idx++}`;
  }
  const set = new Set(state.rows.map(r => r.client.trim()));
  if (!set.has(clientName) && uniqueCount >= 500) { alert('500 client limit reached.'); return; }

  state.rows.push({
    id: `row_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    client: clientName,
    tower: state.towers[0] || 'PTP',
    baseFte: 10,
    assessment: 'Not Started',
    pipelineFte: 0,
    decision: '',
    initiative: '',
    initiativeType: '',
    estimatedFteBenefit: 0,
    implementationCost: 0,
    dollarSavings: 0,
    benchmark: 20,
    owner: 'None',
    region: ''
  });
  renderInputTable();
}

function handleDeleteRow(rowId) {
  state.rows = state.rows.filter(r => r.id !== rowId);
  Object.keys(state.cellData).forEach(k => { if (k.startsWith(`${rowId}::`)) delete state.cellData[k]; });
  renderInputTable();
}

// ==========================================
// RENDER TAB 2: ASSET MAPPING GRID
// ==========================================
function renderAssetGrid() {
  updateFilterDropdowns();
  document.getElementById('assetCount').textContent = state.assets.length;
  const headerRow = document.getElementById('gridHeaderRow');
  headerRow.innerHTML = '<th>Client</th><th>Region</th><th>Tower</th><th>Base FTE</th>';
  state.assets.forEach(asset => {
    const th = document.createElement('th');
    th.className = 'col-center';
    th.textContent = asset;
    headerRow.appendChild(th);
  });
  const thF = document.createElement('th');
  thF.className = 'col-center col-future-header';
  thF.textContent = 'Future State FTE';
  headerRow.appendChild(thF);

  const tbody = document.getElementById('gridBody');
  tbody.innerHTML = '';

  // Apply filters to asset grid
  const filteredRows = getFilteredRows();

  filteredRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${escHtml(row.client)}</strong></td><td>${escHtml(row.region || '')}</td><td><strong>${escHtml(row.tower)}</strong></td><td class="col-num">${row.baseFte}</td>`;

    let deployed = 0, potential = 0, inprog = 0;
    state.assets.forEach(asset => {
      const cellId = `${row.id}::${asset}`;
      const cell = state.cellData[cellId] || { fte: '', status: 'Not Applicable' };
      const fteVal = parseFloat(cell.fte || 0);
      if (cell.status === 'Deployed') deployed += fteVal;
      else if (cell.status === 'Potential but lack CBA') potential += fteVal;
      else if (cell.status === 'In progress') inprog += fteVal;

      const td = document.createElement('td');
      td.className = `asset-cell status-${getCellStatusClass(cell.status)}`;
      td.textContent = cell.fte !== '' && cell.status !== 'Not Applicable' ? cell.fte : '';
      td.onclick = (e) => openCellPopover(e, row.id, asset);
      tr.appendChild(td);
    });

    const future = row.baseFte - deployed - potential - inprog;
    const tdF = document.createElement('td');
    tdF.className = 'col-future-cell';
    tdF.textContent = future;
    tr.appendChild(tdF);
    tbody.appendChild(tr);
  });
}

// ==========================================
// POPOVER
// ==========================================
function openCellPopover(event, rowId, assetId) {
  event.stopPropagation();
  const popover = document.getElementById('cellPopover');
  currentEditingCell = { rowId, assetId };
  const cell = state.cellData[`${rowId}::${assetId}`] || { fte: '', status: 'Not Applicable' };
  selectedPopoverStatus = cell.status;
  document.getElementById('popoverFte').value = cell.fte;
  document.getElementById('popoverTitle').textContent = `${assetId} Allocation`;
  updatePopoverBadgeSelection();
  const rect = event.currentTarget.getBoundingClientRect();
  popover.style.left = `${rect.left + window.scrollX - 80}px`;
  popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
  popover.classList.add('active');
  setTimeout(() => document.getElementById('popoverFte').focus(), 50);
}

function selectPopoverStatus(s) { selectedPopoverStatus = s; updatePopoverBadgeSelection(); }

function updatePopoverBadgeSelection() {
  document.querySelectorAll('.color-badge').forEach(b => {
    b.classList.toggle('selected', b.getAttribute('onclick').includes(`'${selectedPopoverStatus}'`));
  });
}

function closePopover() {
  document.getElementById('cellPopover').classList.remove('active');
  currentEditingCell = null;
}

function handleSavePopover() {
  if (!currentEditingCell) return;
  const { rowId, assetId } = currentEditingCell;
  const cellId = `${rowId}::${assetId}`;
  const fteNum = parseFloat(document.getElementById('popoverFte').value) || 0;

  if (selectedPopoverStatus === 'Not Applicable') {
    delete state.cellData[cellId];
  } else {
    state.cellData[cellId] = { fte: fteNum, status: selectedPopoverStatus };
  }

  const row = state.rows.find(r => r.id === rowId);
  if (row && row.initiative === assetId) {
    row.estimatedFteBenefit = selectedPopoverStatus === 'Not Applicable' ? 0 : fteNum;
    if (selectedPopoverStatus && selectedPopoverStatus !== 'Not Applicable') row.decision = selectedPopoverStatus;
  }

  closePopover();
  renderAssetGrid();
}

// ==========================================
// RENDER TAB 3: INSIGHTS — full executive view
// ==========================================

// Chart instance registry
let chartInstances = {};

// Destroy a chart safely
function destroyChart(key) {
  if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; }
}

// ---- Asset penetration calculations ----
function calcAssetPenetration() {
  let totalBaseline = 0, deployedFTE = 0, inProgressFTE = 0, potentialFTE = 0;

  state.rows.forEach(r => { totalBaseline += parseFloat(r.baseFte || 0); });

  Object.values(state.cellData).forEach(cell => {
    const v = parseFloat(cell.fte || 0);
    if (cell.status === 'Deployed') deployedFTE += v;
    else if (cell.status === 'In progress') inProgressFTE += v;
    else if (cell.status === 'Potential but lack CBA') potentialFTE += v;
  });

  // Per-tower penetration
  const towerPen = {};
  state.towers.forEach(tower => {
    const tRows = state.rows.filter(r => r.tower === tower);
    const tBase = tRows.reduce((s, r) => s + parseFloat(r.baseFte || 0), 0);
    let tDep = 0, tIP = 0;
    tRows.forEach(row => {
      state.assets.forEach(asset => {
        const cell = state.cellData[`${row.id}::${asset}`];
        if (!cell) return;
        const v = parseFloat(cell.fte || 0);
        if (cell.status === 'Deployed') tDep += v;
        else if (cell.status === 'In progress') tIP += v;
      });
    });
    towerPen[tower] = {
      baseline: tBase,
      deployed: tDep,
      inProgress: tIP,
      deployedPct: tBase > 0 ? (tDep / tBase * 100) : 0,
      coveragePct: tBase > 0 ? ((tDep + tIP) / tBase * 100) : 0,
      rowCount: tRows.length
    };
  });

  const overallDeployedPct = totalBaseline > 0 ? (deployedFTE / totalBaseline * 100) : 0;
  const overallCoveragePct = totalBaseline > 0 ? ((deployedFTE + inProgressFTE) / totalBaseline * 100) : 0;

  return { totalBaseline, deployedFTE, inProgressFTE, potentialFTE, overallDeployedPct, overallCoveragePct, towerPen };
}

function penColorClass(pct) {
  if (pct >= 40) return 'pen-green';
  if (pct >= 20) return 'pen-blue';
  if (pct >= 10) return 'pen-amber';
  return 'pen-red';
}

function renderPenetrationBand(pen) {
  const band = document.getElementById('penetrationBand');
  if (!band) return;

  let html = `
    <div class="pen-card pen-overall ${penColorClass(pen.overallCoveragePct)}">
      <div class="pen-card-label">&#127759; Overall Portfolio</div>
      <div class="pen-card-value">${pen.overallCoveragePct.toFixed(1)}%</div>
      <div class="pen-card-sub">Deployed: ${pen.overallDeployedPct.toFixed(1)}%</div>
    </div>
    <div class="pen-divider"></div>
  `;

  Object.entries(pen.towerPen).forEach(([tower, data]) => {
    if (data.rowCount === 0) return;
    html += `
      <div class="pen-card ${penColorClass(data.coveragePct)}">
        <div class="pen-card-label">${escHtml(tower)}</div>
        <div class="pen-card-value">${data.coveragePct.toFixed(1)}%</div>
        <div class="pen-card-sub">${data.deployed.toFixed(0)} dep / ${data.baseline} base FTE</div>
      </div>
    `;
  });

  band.innerHTML = html;
}

function renderInsights() {
  // ---- Aggregate metrics ----
  let totalBaseline = 0, totalPipeline = 0, completedCount = 0, totalRows = 0;
  let approvedCount = 0;
  const towerStats = {};

  state.rows.forEach(row => {
    const t = row.tower;
    if (!towerStats[t]) towerStats[t] = { base: 0, pipe: 0, benchmark: getTowerBenchmark(t) };
    totalBaseline += parseFloat(row.baseFte || 0);
    totalPipeline += parseFloat(row.pipelineFte || 0);
    totalRows++;
    if (row.assessment === 'Completed') completedCount++;
    if (row.decision === 'Deployed' || row.decision === 'In progress') approvedCount++;
    towerStats[t].base += parseFloat(row.baseFte || 0);
    towerStats[t].pipe += parseFloat(row.pipelineFte || 0);
  });

  const pen = calcAssetPenetration();

  // ---- KPI cards ----
  document.getElementById('kpiBaseline').textContent = totalBaseline;
  document.getElementById('kpiPipeline').textContent = totalPipeline;
  document.getElementById('kpiAssessments').textContent = `${totalRows > 0 ? ((completedCount / totalRows) * 100).toFixed(0) : 0}%`;
  document.getElementById('kpiYield').textContent = `${totalBaseline > 0 ? ((totalPipeline / totalBaseline) * 100).toFixed(1) : 0}%`;
  document.getElementById('kpiDeployed').textContent = pen.deployedFTE.toFixed(0);
  document.getElementById('kpiPotential').textContent = pen.potentialFTE.toFixed(0);

  // ---- Penetration band ----
  renderPenetrationBand(pen);

  // ---- Charts ----
  renderTowerChart(towerStats);
  renderApprovalChart();
  renderHeatmapChart();
  renderPotentialChart();

  // ---- Insights list ----
  renderInsightsList(towerStats, totalBaseline, totalPipeline, approvedCount, completedCount, pen);
}

// Chart 1: Pipeline vs Benchmark by Tower
function renderTowerChart(towerStats) {
  destroyChart('tower');
  const ctx = document.getElementById('insightsChart');
  if (!ctx) return;
  const labels = Object.keys(towerStats);
  const actual = labels.map(l => towerStats[l].base > 0 ? ((towerStats[l].pipe / towerStats[l].base) * 100).toFixed(1) : 0);
  const bench = labels.map(l => towerStats[l].benchmark);
  chartInstances['tower'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Actual Release %', data: actual, backgroundColor: 'rgba(79,129,189,0.85)', borderColor: '#1f497d', borderWidth: 1 },
        { label: 'Benchmark %', data: bench, backgroundColor: 'rgba(255,192,0,0.85)', borderColor: '#e27c00', borderWidth: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } },
      plugins: { legend: { position: 'top', labels: { font: { size: 9 }, boxWidth: 10 } } }
    }
  });
}

// Chart 2: Client Approval Status Distribution (Doughnut)
function renderApprovalChart() {
  destroyChart('approval');
  const ctx = document.getElementById('approvalChart');
  if (!ctx) return;

  const counts = {};
  const labels_map = {
    'Deployed': 'Deployed',
    'In progress': 'In Progress',
    'Potential but lack CBA': 'Potential/Lack CBA',
    'Awaiting client approvals': 'Awaiting Approval',
    'Not Applicable': 'Not Applicable',
    '': 'Not Selected'
  };
  state.rows.forEach(r => {
    const k = r.decision || '';
    counts[k] = (counts[k] || 0) + 1;
  });

  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  const labels = entries.map(([k]) => labels_map[k] || k);
  const data = entries.map(([, v]) => v);
  const colors = entries.map(([k]) => {
    if (k === 'Deployed') return 'rgba(112,173,71,0.85)';
    if (k === 'In progress') return 'rgba(255,192,0,0.85)';
    if (k === 'Potential but lack CBA') return 'rgba(198,239,206,0.9)';
    if (k === 'Awaiting client approvals') return 'rgba(166,166,166,0.85)';
    if (k === 'Not Applicable') return 'rgba(220,220,220,0.85)';
    return 'rgba(200,200,200,0.5)';
  });

  chartInstances['approval'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw} clients` } }
      }
    }
  });
}

// Chart 3: Asset Penetration by Client (Horizontal Bar, Top 10)
function renderHeatmapChart() {
  destroyChart('heatmap');
  const ctx = document.getElementById('heatmapChart');
  if (!ctx || state.assets.length === 0) return;

  // Per unique client: total deployed+in-progress cells / total possible cells
  const clientMap = {};
  state.rows.forEach(row => {
    const c = row.client;
    if (!clientMap[c]) clientMap[c] = { deployed: 0, inprog: 0, possible: 0 };
    state.assets.forEach(asset => {
      clientMap[c].possible++;
      const cell = state.cellData[`${row.id}::${asset}`];
      if (!cell) return;
      if (cell.status === 'Deployed') clientMap[c].deployed++;
      else if (cell.status === 'In progress') clientMap[c].inprog++;
    });
  });

  const sorted = Object.entries(clientMap)
    .map(([name, d]) => ({ name, pct: d.possible > 0 ? ((d.deployed + d.inprog) / d.possible * 100) : 0, dep: d.deployed, ip: d.inprog }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);

  chartInstances['heatmap'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => x.name.length > 14 ? x.name.slice(0, 13) + '…' : x.name),
      datasets: [
        { label: 'Deployed %', data: sorted.map(x => x.dep / (x.dep + x.ip + 0.001) * x.pct), backgroundColor: 'rgba(112,173,71,0.85)' },
        { label: 'In Progress %', data: sorted.map(x => x.ip / (x.dep + x.ip + 0.001) * x.pct), backgroundColor: 'rgba(255,192,0,0.75)' }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { size: 9 } } },
        y: { stacked: true, ticks: { font: { size: 9 } } }
      },
      plugins: { legend: { position: 'top', labels: { font: { size: 9 }, boxWidth: 10 } } }
    }
  });
}

// Chart 4: High Opportunity Targets — clients with most "Potential but lack CBA" FTE
function renderPotentialChart() {
  destroyChart('potential');
  const ctx = document.getElementById('potentialChart');
  if (!ctx) return;

  const clientPotential = {};
  const clientCBA_count = {};  // assets with Potential but lack CBA per client

  state.rows.forEach(row => {
    const c = row.client;
    if (!clientPotential[c]) { clientPotential[c] = 0; clientCBA_count[c] = 0; }
    state.assets.forEach(asset => {
      const cell = state.cellData[`${row.id}::${asset}`];
      if (cell && cell.status === 'Potential but lack CBA') {
        clientPotential[c] += parseFloat(cell.fte || 0);
        clientCBA_count[c]++;
      }
    });
    // Also count from row-level decision
    if (row.decision === 'Potential but lack CBA') {
      clientPotential[c] += parseFloat(row.estimatedFteBenefit || 0);
    }
  });

  const sorted = Object.entries(clientPotential)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) {
    // No data — show placeholder text
    const c2 = ctx.getContext('2d');
    c2.fillStyle = '#aaa';
    c2.font = '12px Outfit';
    c2.textAlign = 'center';
    c2.fillText('No "Potential but lack CBA" data found.', ctx.width / 2, ctx.height / 2);
    return;
  }

  chartInstances['potential'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([name]) => name.length > 14 ? name.slice(0, 13) + '…' : name),
      datasets: [{
        label: 'Potential FTE (Lack CBA)',
        data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(198,239,206,0.9)',
        borderColor: 'rgba(112,173,71,1)',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 9 } } },
        y: { ticks: { font: { size: 9 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.raw.toFixed(0)} FTE potential` } }
      }
    }
  });
}

// ---- Insights List (auto + custom, editable) ----
function renderInsightsList(towerStats, totalBase, totalPipe, approvedCount, completedCount, pen) {
  const container = document.getElementById('insightsList');
  container.innerHTML = '';

  // ---- Auto-generated insights ----
  const autoInsights = [];
  const yield_ = totalBase > 0 ? (totalPipe / totalBase) * 100 : 0;
  if (yield_ >= 22.5) autoInsights.push({ title: 'Excellent Portfolio Yield', desc: `Overall yield <strong>${yield_.toFixed(1)}%</strong> exceeds 22.5% benchmark.`, type: 'success' });
  else autoInsights.push({ title: 'Target Yield Deficit', desc: `Portfolio yield <strong>${yield_.toFixed(1)}%</strong> vs 22.5% benchmark. Identify more opportunities.`, type: 'warning' });

  // Asset penetration insight
  if (pen.overallCoveragePct >= 30) autoInsights.push({ title: 'Strong Asset Penetration', desc: `Overall asset coverage at <strong>${pen.overallCoveragePct.toFixed(1)}%</strong> of baseline FTE. Portfolio is well covered.`, type: 'success' });
  else autoInsights.push({ title: 'Asset Coverage Gap', desc: `Only <strong>${pen.overallCoveragePct.toFixed(1)}%</strong> of baseline FTE covered by deployed/in-progress assets. Scale initiatives.`, type: 'warning' });

  // Tower-level insights
  Object.keys(towerStats).forEach(t => {
    const s = towerStats[t];
    if (s.base > 0) {
      const diff = (s.pipe / s.base * 100) - s.benchmark;
      if (diff >= 5) autoInsights.push({ title: `Leader: ${t} Tower`, desc: `${t} exceeds benchmark by <strong>+${diff.toFixed(1)}%</strong>.`, type: 'success' });
      else if (diff < -5) autoInsights.push({ title: `Gap: ${t} Tower`, desc: `${t} is <strong>${Math.abs(diff).toFixed(1)}%</strong> below target. Review opportunities.`, type: 'warning' });
    }
  });

  // Approval rate insight
  if (completedCount > 0) {
    const rate = (approvedCount / completedCount * 100);
    if (rate < 70) autoInsights.push({ title: 'Approval Action Needed', desc: `Client approval rate at <strong>${rate.toFixed(0)}%</strong> is low. Prioritize client engagement.`, type: 'warning' });
    else autoInsights.push({ title: 'Strong Client Buy-in', desc: `Client approval rate at <strong>${rate.toFixed(0)}%</strong>. Ensure delivery resourcing.`, type: 'success' });
  }

  // Potential FTE insight
  if (pen.potentialFTE > 0) {
    autoInsights.push({ title: 'Untapped Potential FTE', desc: `<strong>${pen.potentialFTE.toFixed(0)} FTE</strong> is classified as "Potential but lack CBA". Prioritise business cases for these opportunities.`, type: 'warning' });
  }

  // Render auto insights
  autoInsights.forEach((ins, i) => {
    const div = document.createElement('div');
    div.className = `insight-card ${ins.type}`;
    div.id = `auto-ins-${i}`;
    div.innerHTML = `
      <div class="insight-card-header">
        <div class="insight-title">${ins.title} <span class="insight-system-badge">⚙ Auto</span></div>
        <div class="insight-actions">
          <button class="insight-btn" onclick="editAutoInsight(${i})" title="Edit">✏️</button>
        </div>
      </div>
      <div class="insight-body" id="auto-body-${i}">${ins.desc}</div>
      <div class="insight-edit-form" id="auto-edit-${i}" style="display:none;">
        <input class="insight-text-input" id="auto-edit-title-${i}" value="${ins.title.replace(/"/g, '&quot;')}">
        <textarea class="insight-textarea" id="auto-edit-desc-${i}">${ins.desc.replace(/<[^>]+>/g, '')}</textarea>
        <div class="insight-type-row">
          <button class="btn btn-sm btn-primary" onclick="saveAutoInsightEdit(${i}, '${ins.type}')">Save</button>
          <button class="btn btn-sm btn-secondary" onclick="cancelAutoInsightEdit(${i})">Cancel</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  // ---- Custom insights ----
  if (!state.customInsights) state.customInsights = [];
  state.customInsights.forEach((ins) => {
    const div = document.createElement('div');
    div.className = `insight-card ${ins.type}`;
    div.innerHTML = `
      <div class="insight-card-header">
        <div class="insight-title">${escHtml(ins.title)} <span class="insight-custom-badge">✎ Custom</span></div>
        <div class="insight-actions">
          <button class="insight-btn" onclick="editCustomInsight('${ins.id}')" title="Edit">✏️</button>
          <button class="insight-btn danger" onclick="deleteCustomInsight('${ins.id}')" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="insight-body" id="custom-body-${ins.id}">${escHtml(ins.desc)}</div>
      <div class="insight-edit-form" id="custom-edit-${ins.id}" style="display:none;">
        <input class="insight-text-input" id="custom-edit-title-${ins.id}" value="${escHtml(ins.title)}">
        <textarea class="insight-textarea" id="custom-edit-desc-${ins.id}">${escHtml(ins.desc)}</textarea>
        <div class="insight-type-row">
          <select id="custom-edit-type-${ins.id}">
            <option value="info" ${ins.type === 'info' ? 'selected' : ''}>Info</option>
            <option value="success" ${ins.type === 'success' ? 'selected' : ''}>Positive</option>
            <option value="warning" ${ins.type === 'warning' ? 'selected' : ''}>Warning</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="saveCustomInsightEdit('${ins.id}')">Save</button>
          <button class="btn btn-sm btn-secondary" onclick="cancelCustomInsightEdit('${ins.id}')">Cancel</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ---- Auto insight inline edit ----
function editAutoInsight(i) {
  document.getElementById(`auto-body-${i}`).style.display = 'none';
  document.getElementById(`auto-edit-${i}`).style.display = 'block';
}
function cancelAutoInsightEdit(i) {
  document.getElementById(`auto-body-${i}`).style.display = '';
  document.getElementById(`auto-edit-${i}`).style.display = 'none';
}
function saveAutoInsightEdit(i, origType) {
  const title = document.getElementById(`auto-edit-title-${i}`).value.trim();
  const desc = document.getElementById(`auto-edit-desc-${i}`).value.trim();
  if (!title) return;
  // Promote to custom insight
  const id = `custom_${Date.now()}_${i}`;
  if (!state.customInsights) state.customInsights = [];
  state.customInsights.push({ id, title, desc, type: origType });
  renderInsights();
}

// ---- Custom insight actions ----
function addCustomInsight() {
  const form = document.getElementById('addInsightForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') document.getElementById('newInsightTitle').focus();
}

function cancelAddInsight() {
  document.getElementById('addInsightForm').style.display = 'none';
  document.getElementById('newInsightTitle').value = '';
  document.getElementById('newInsightDesc').value = '';
}

function saveNewInsight() {
  const title = document.getElementById('newInsightTitle').value.trim();
  const desc = document.getElementById('newInsightDesc').value.trim();
  const type = document.getElementById('newInsightType').value;
  if (!title) { alert('Title is required.'); return; }
  if (!state.customInsights) state.customInsights = [];
  state.customInsights.push({ id: `custom_${Date.now()}`, title, desc, type });
  cancelAddInsight();
  renderInsights();
}

function deleteCustomInsight(id) {
  if (!confirm('Delete this insight?')) return;
  state.customInsights = (state.customInsights || []).filter(x => x.id !== id);
  renderInsights();
}

function editCustomInsight(id) {
  document.getElementById(`custom-body-${id}`).style.display = 'none';
  document.getElementById(`custom-edit-${id}`).style.display = 'block';
}
function cancelCustomInsightEdit(id) {
  document.getElementById(`custom-body-${id}`).style.display = '';
  document.getElementById(`custom-edit-${id}`).style.display = 'none';
}
function saveCustomInsightEdit(id) {
  const title = document.getElementById(`custom-edit-title-${id}`).value.trim();
  const desc = document.getElementById(`custom-edit-desc-${id}`).value.trim();
  const type = document.getElementById(`custom-edit-type-${id}`).value;
  if (!title) return;
  const ins = (state.customInsights || []).find(x => x.id === id);
  if (ins) { ins.title = title; ins.desc = desc; ins.type = type; }
  renderInsights();
}

// ==========================================
// MODALS
// ==========================================
function openModal(id) {
  document.getElementById(id).classList.add('active');
  if (id === 'modal-asset') populateAssetModalList();
  if (id === 'modal-owner') populateOwnerModalList();
  if (id === 'modal-tower') populateTowerModalList();
  if (id === 'modal-type') populateTypeModalList();
  if (id === 'modal-region') populateRegionModalList();
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// --- Region Master ---
function populateRegionModalList() {
  const c = document.getElementById('modalRegionList');
  c.innerHTML = state.regions.length
    ? state.regions.map(r => `
      <div class="list-item">
        <span><strong>${escHtml(r)}</strong></span>
        <button class="list-item-btn" onclick="handleDeleteRegion('${escHtml(r)}')">&times;</button>
      </div>`).join('')
    : '<div class="list-item" style="color:#aaa;">No regions defined.</div>';
}

function handleAddRegion() {
  const input = document.getElementById('newRegionName');
  const raw = input.value.trim();
  if (!raw) return;
  if (raw.length > 40) { alert('Region name too long (max 40 chars).'); return; }
  if (state.regions.includes(raw)) { alert('Region already exists.'); return; }
  state.regions.push(raw);
  input.value = '';
  populateRegionModalList();
  updateFilterDropdowns();
  saveData();
}

function handleDeleteRegion(regionName) {
  if (!confirm(`Delete region "${regionName}"? It will be cleared from all rows.`)) return;
  state.regions = state.regions.filter(r => r !== regionName);
  // Clear from all rows
  state.rows.forEach(row => { if (row.region === regionName) row.region = ''; });
  populateRegionModalList();
  updateFilterDropdowns();
  renderInputTable();
  saveData();
}


// --- Tower Master ---
function populateTowerModalList() {
  const c = document.getElementById('modalTowerList');
  c.innerHTML = state.towers.length
    ? state.towers.map(t => `
      <div class="list-item">
        <span><strong>${escHtml(t)}</strong></span>
        <button class="list-item-btn" onclick="handleDeleteTower('${escHtml(t)}')">&times;</button>
      </div>`).join('')
    : '<div class="list-item" style="color:#aaa;">No towers defined.</div>';
}

function handleAddTower() {
  const input = document.getElementById('newTowerName');
  const raw = input.value.trim();
  // Allow letters, spaces, ampersand, hyphens (FP&A style)
  if (!raw) return;
  if (!/^[A-Za-z& \-\/]+$/.test(raw)) {
    alert('Tower name can only contain letters, spaces, &, /, or -. No numbers or special characters.');
    return;
  }
  if (state.towers.map(t => t.toLowerCase()).includes(raw.toLowerCase())) {
    alert('Tower already exists.');
    return;
  }
  state.towers.push(raw);
  input.value = '';
  populateTowerModalList();
}

function handleDeleteTower(towerName) {
  if (!confirm(`Delete tower "${towerName}"? This will remove ALL rows assigned to this tower and their asset data.`)) return;

  // Collect row IDs to delete
  const toDelete = state.rows.filter(r => r.tower === towerName).map(r => r.id);

  // Remove cell data for those rows
  toDelete.forEach(rowId => {
    Object.keys(state.cellData).forEach(k => { if (k.startsWith(`${rowId}::`)) delete state.cellData[k]; });
  });

  // Remove rows
  state.rows = state.rows.filter(r => r.tower !== towerName);

  // Remove from tower master
  state.towers = state.towers.filter(t => t !== towerName);

  populateTowerModalList();
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
}

// --- Initiative Type Master ---
function populateTypeModalList() {
  const c = document.getElementById('modalTypeList');
  document.getElementById('typeCount').textContent = state.initiativeTypes.length;
  c.innerHTML = state.initiativeTypes.length
    ? state.initiativeTypes.map(t => `
      <div class="list-item">
        <span><strong>${escHtml(t)}</strong></span>
        <button class="list-item-btn" onclick="handleDeleteType('${escHtml(t)}')">&times;</button>
      </div>`).join('')
    : '<div class="list-item" style="color:#aaa;">No types defined. Add up to 4.</div>';
}

function handleAddType() {
  if (state.initiativeTypes.length >= 4) { alert('Maximum 4 initiative types allowed.'); return; }
  const input = document.getElementById('newTypeName');
  const val = input.value.trim();
  if (!val) return;
  if (state.initiativeTypes.map(t => t.toLowerCase()).includes(val.toLowerCase())) { alert('Type already exists.'); return; }
  state.initiativeTypes.push(val);
  input.value = '';
  populateTypeModalList();
  renderInputTable();
}

function handleDeleteType(typeName) {
  if (!confirm(`Delete type "${typeName}"? Rows using this type will be cleared.`)) return;
  state.initiativeTypes = state.initiativeTypes.filter(t => t !== typeName);
  state.rows.forEach(r => { if (r.initiativeType === typeName) r.initiativeType = ''; });
  populateTypeModalList();
  renderInputTable();
}

// --- Asset Modal ---
function populateAssetModalList() {
  const c = document.getElementById('modalAssetList');
  c.innerHTML = state.assets.length
    ? state.assets.map(a => `
      <div class="list-item">
        <span><strong>${escHtml(a)}</strong></span>
        <button class="list-item-btn" onclick="handleDeleteAsset('${escHtml(a)}')">&times;</button>
      </div>`).join('')
    : '<div class="list-item" style="color:#aaa;">No assets defined.</div>';
}

function handleAddAsset() {
  if (state.assets.length >= 100) { alert('Max 100 assets reached.'); return; }
  const input = document.getElementById('newAssetName');
  const name = input.value.trim();
  if (!name) return;
  if (state.assets.includes(name)) { alert('Asset already exists.'); return; }
  state.assets.push(name);
  input.value = '';
  populateAssetModalList();
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
}

function handleDeleteAsset(asset) {
  if (!confirm(`Delete asset column "${asset}"?`)) return;
  state.assets = state.assets.filter(a => a !== asset);
  Object.keys(state.cellData).forEach(k => { if (k.endsWith(`::${asset}`)) delete state.cellData[k]; });
  populateAssetModalList();
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
}

// --- Owner Modal ---
function populateOwnerModalList() {
  const c = document.getElementById('modalOwnerList');
  const keys = Object.keys(state.owners);
  c.innerHTML = keys.length
    ? keys.map(n => `
      <div class="list-item">
        <span><strong>${escHtml(n)}</strong> (${escHtml(state.owners[n])})</span>
        <button class="list-item-btn" onclick="handleDeleteOwner('${escHtml(n)}')">&times;</button>
      </div>`).join('')
    : '<div class="list-item" style="color:#aaa;">No owners registered.</div>';
}

function handleAddOwner() {
  const name = document.getElementById('newOwnerName').value.trim();
  const email = document.getElementById('newOwnerEmail').value.trim();
  if (!name || !email) { alert('Both name and email are required.'); return; }
  if (state.owners[name]) { alert('Owner already exists.'); return; }
  state.owners[name] = email;
  document.getElementById('newOwnerName').value = '';
  document.getElementById('newOwnerEmail').value = '';
  populateOwnerModalList();
  renderInputTable();
}

function handleDeleteOwner(name) {
  if (!confirm(`Delete owner "${name}"?`)) return;
  delete state.owners[name];
  state.rows.forEach(r => { if (r.owner === name) r.owner = 'None'; });
  populateOwnerModalList();
  renderInputTable();
}

// ==========================================
// BULK XLS UPLOAD
// ==========================================
function handleBulkUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      let newRows = 0, newAssets = 0;

      // Sheet 1: Master Tracker
      const masterSheet = wb.SheetNames.find(n => n.toLowerCase().includes('master') || n.toLowerCase().includes('tracker')) || wb.SheetNames[0];
      if (masterSheet) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[masterSheet], { defval: '' });
        rows.forEach(r => {
          const client = String(r['Client Name'] || r['Client'] || '').trim();
          const tower = String(r['Tower'] || '').trim();
          const region = String(r['Region'] || '').trim();
          const init = String(r['Proposed Asset'] || r['Proposed Initiative'] || '').trim();
          if (!client || !tower) return;

          // Auto-add tower to master if not present
          if (!state.towers.map(t => t.toLowerCase()).includes(tower.toLowerCase())) {
            state.towers.push(tower);
          }

          // Auto-add region to master if not present
          if (region && !state.regions.map(reg => reg.toLowerCase()).includes(region.toLowerCase())) {
            state.regions.push(region);
          }

          const existing = state.rows.find(x =>
            x.client.toLowerCase() === client.toLowerCase() &&
            x.tower.toLowerCase() === tower.toLowerCase() &&
            (x.region || '').toLowerCase() === region.toLowerCase() &&
            (x.initiative || '').toLowerCase() === init.toLowerCase()
          );

          const applyFields = (target) => {
            if (r['Region'] !== undefined) target.region = String(r['Region']).trim();
            if (r['Baseline FTE'] !== '') target.baseFte = Math.max(0, parseInt(r['Baseline FTE']) || 0);
            if (r['Assessment Status'] !== '') target.assessment = String(r['Assessment Status']).trim();
            if (r['Agentic Potential FTE'] !== '') target.pipelineFte = parseFloat(r['Agentic Potential FTE']) || 0;
            if (r['Client Decision'] !== '' || r['Client Approval for AI'] !== '') target.decision = String(r['Client Decision'] || r['Client Approval for AI'] || '').trim();
            if (r['Proposed Asset'] !== undefined) target.initiative = String(r['Proposed Asset']).trim();
            else if (r['Proposed Initiative'] !== '') target.initiative = String(r['Proposed Initiative']).trim();
            if (r['Type'] !== '') target.initiativeType = String(r['Type']).trim();
            if (r['Estimated FTE Benefit'] !== '') target.estimatedFteBenefit = parseFloat(r['Estimated FTE Benefit']) || 0;
            if (r['Implementation Cost ($)'] !== '') target.implementationCost = parseFloat(r['Implementation Cost ($)']) || 0;
            if (r['$ Savings'] !== '') target.dollarSavings = parseFloat(r['$ Savings']) || 0;
            if (r['Benchmark %'] !== '') target.benchmark = parseFloat(String(r['Benchmark %']).replace('%', '')) || 20;
            if (r['Owner'] !== '') target.owner = String(r['Owner']).trim() || 'None';
          };

          if (existing) {
            applyFields(existing);
          } else {
            const uniq = new Set(state.rows.map(x => x.client.trim()));
            if (!uniq.has(client) && uniq.size >= 500) return;
            if (state.rows.filter(x => x.client.toLowerCase() === client.toLowerCase()).length >= 8) return;
            const newRow = {
              id: `row_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
              client, tower, region: region || '', baseFte: 10, assessment: 'Not Started',
              pipelineFte: 0, decision: '', initiative: '', initiativeType: '',
              estimatedFteBenefit: 0, implementationCost: 0, dollarSavings: 0, benchmark: 20, owner: 'None'
            };
            applyFields(newRow);
            state.rows.push(newRow);
            newRows++;
          }

          if (init && !state.assets.includes(init) && state.assets.length < 100) { state.assets.push(init); newAssets++; }
          const type = String(r['Type'] || '').trim();
          if (type && !state.initiativeTypes.includes(type) && state.initiativeTypes.length < 4) state.initiativeTypes.push(type);
        });
      }

      // Sheet 2: Asset Mapping
      const assetSheet = wb.SheetNames.find(n => n.toLowerCase().includes('asset'));
      if (assetSheet) {
        const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[assetSheet], { header: 1, defval: '' });
        if (jsonData.length > 1) {
          const headers = jsonData[0].map(h => String(h).trim());
          const assetCols = headers.slice(4, headers.length - 1);
          assetCols.forEach(col => {
            const clean = col.replace(/^Asset\s+/i, '').trim();
            if (clean && !['future state fte'].includes(clean.toLowerCase()) && !state.assets.includes(clean) && state.assets.length < 100) { state.assets.push(clean); newAssets++; }
          });
          for (let i = 1; i < jsonData.length; i++) {
            const rowArr = jsonData[i];
            const rClient = String(rowArr[0] || '').trim();
            const rRegion = String(rowArr[1] || '').trim();
            const rTower = String(rowArr[2] || '').trim();
            if (!rClient || !rTower) continue;
            const matchRow = state.rows.find(r =>
              r.client.toLowerCase() === rClient.toLowerCase() &&
              r.tower.toLowerCase() === rTower.toLowerCase() &&
              (r.region || '').toLowerCase() === rRegion.toLowerCase()
            );
            if (!matchRow) continue;
            assetCols.forEach((col, idx) => {
              const clean = col.replace(/^Asset\s+/i, '').trim();
              const val = String(rowArr[4 + idx] || '').trim();
              if (!val || !clean) return;
              const m = val.match(/^([\d.]+)\s*\((.+)\)$/);
              if (m) { state.cellData[`${matchRow.id}::${clean}`] = { fte: parseFloat(m[1]) || 0, status: m[2].trim() }; }
              else if (!isNaN(parseFloat(val))) { state.cellData[`${matchRow.id}::${clean}`] = { fte: parseFloat(val), status: 'Deployed' }; }
            });
          }
        }
      }

      renderInputTable();
      if (activeTab === 'tab-assets') renderAssetGrid();
      alert(`Bulk upload complete!\nNew rows: ${newRows} | New assets: ${newAssets}`);
    } catch (err) {
      console.error('Bulk upload error:', err);
      alert('Failed to parse file. Please use the downloaded template format.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ==========================================
// DOWNLOAD BULK UPLOAD TEMPLATE
// ==========================================
function downloadBulkTemplate() {
  try {
    const wb = XLSX.utils.book_new();

    const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }, fill: { fgColor: { rgb: '1F497D' } }, alignment: { horizontal: 'center', wrapText: true } };
    const hintStyle = { font: { italic: true, color: { rgb: '7F7F7F' }, sz: 9 }, fill: { fgColor: { rgb: 'FFF2CC' } }, alignment: { wrapText: true } };
    const sampleStyle = { font: { sz: 10 }, fill: { fgColor: { rgb: 'F2F2F2' } } };

    // Sheet 1: Master_Tracker
    const masterCols = ['Client Name', 'Region', 'Tower', 'Baseline FTE', 'Assessment Status', 'Agentic Potential FTE',
      'Client Approval for AI', 'Proposed Asset', 'Type', 'Estimated FTE Benefit', 'Implementation Cost ($)', '$ Savings', 'Owner', 'Benchmark %'];
    const masterHints = [
      'Unique client name (max 500)', 'Region name from master list (e.g. APAC, EMEA, Americas)', 'Tower name from master list (max 8 per client)',
      'Whole number ≥ 0', 'Not Started / In Progress / Completed / No Scale',
      'Fill if In Progress or Completed', 'Select / Deployed / Potential but lack CBA / In progress / Awaiting client approvals / Not Applicable',
      'Asset name (creates asset column if new)', 'From initiative type master (max 4 types)',
      'Fill if In Progress or Completed', 'USD number', 'USD number (negative allowed)', 'Owner name', 'Number 0-100'
    ];
    const masterSamples = [
      ['Client Alpha', 'APAC', 'PTP', 150, 'Completed', 30, 'Deployed', 'Invoice Automation', 'Agentic', 28, 75000, 120000, 'Jane Smith', 25],
      ['Client Alpha', 'APAC', 'RTR', 80, 'In Progress', 15, 'In progress', 'GL Reconciliation Bot', 'RPA', 12, 40000, 60000, 'Jane Smith', 20],
      ['Client Beta', 'EMEA', 'OTC', 200, 'Not Started', 0, 'Select', '', '', 0, 0, 0, 'None', 20],
      ['Client Beta', 'Americas', 'FP&A', 100, 'No Scale', 0, 'Not Applicable', '', '', 0, 0, 0, 'None', 0],
    ];
    const wsMaster = XLSX.utils.aoa_to_sheet([masterCols, masterHints, ...masterSamples]);
    wsMaster['!cols'] = masterCols.map(() => ({ wch: 22 }));
    wsMaster['!rows'] = [{ hpt: 22 }, { hpt: 40 }];
    masterCols.forEach((_, ci) => {
      const r0 = XLSX.utils.encode_cell({ r: 0, c: ci }); if (wsMaster[r0]) wsMaster[r0].s = hdrStyle;
      const r1 = XLSX.utils.encode_cell({ r: 1, c: ci }); if (wsMaster[r1]) wsMaster[r1].s = hintStyle;
    });
    masterSamples.forEach((_, ri) => masterCols.forEach((__, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri + 2, c: ci }); if (wsMaster[ref]) wsMaster[ref].s = sampleStyle;
    }));
    XLSX.utils.book_append_sheet(wb, wsMaster, 'Master_Tracker');

    // Sheet 2: Asset_Mapping
    const assetNames = state.assets.length > 0 ? state.assets : ['Invoice Automation', 'GL Reconciliation Bot', 'AP Matching Engine'];
    const assetHdrs = ['Client Name', 'Region', 'Tower', 'Base FTE', ...assetNames, 'Future State FTE'];
    const assetHints = ['Same as Master_Tracker', 'Same as Master_Tracker', 'Same as Master_Tracker', 'Baseline FTE',
      ...assetNames.map(() => 'FTE count (status defaults to Deployed)'), 'Auto-calculated (leave blank)'];
    const assetSamples = [
      ['Client Alpha', 'APAC', 'PTP', 150, ...assetNames.map((a, i) => i === 0 ? 28 : ''), ''],
      ['Client Alpha', 'APAC', 'RTR', 80, ...assetNames.map((a, i) => i === 1 ? 12 : ''), ''],
    ];
    const wsAsset = XLSX.utils.aoa_to_sheet([assetHdrs, assetHints, ...assetSamples]);
    wsAsset['!cols'] = assetHdrs.map(() => ({ wch: 22 }));
    wsAsset['!rows'] = [{ hpt: 22 }, { hpt: 36 }];
    assetHdrs.forEach((_, ci) => {
      const r0 = XLSX.utils.encode_cell({ r: 0, c: ci }); if (wsAsset[r0]) wsAsset[r0].s = hdrStyle;
      const r1 = XLSX.utils.encode_cell({ r: 1, c: ci }); if (wsAsset[r1]) wsAsset[r1].s = hintStyle;
    });
    XLSX.utils.book_append_sheet(wb, wsAsset, 'Asset_Mapping');

    // Sheet 3: Instructions
    const instr = [
      ['AI Penetration Tracker – Bulk Upload Template'], [''],
      ['STEPS'],
      ['1', 'Fill Master_Tracker sheet (delete hint row before upload, or leave – rows with no Client Name are skipped)'],
      ['2', 'Optionally fill Asset_Mapping to pre-load the asset grid'],
      ['3', 'Click "📄 Bulk Upload XLS" on the dashboard'],
      ['4', 'Click "Save to File" to persist changes'], [''],
      ['FIELD RULES'],
      ['Tower', 'Must be a valid tower. New towers in file will be auto-added.'],
      ['Baseline FTE', 'Whole number ≥ 0. Must be ≥ Agentic Potential FTE.'],
      ['Assessment Status', 'Not Started | In Progress | Completed | No Scale'],
      ['Client Approval for AI', 'Select | Deployed | Potential but lack CBA | In progress | Awaiting client approvals | Not Applicable'],
      ['Type', 'Must match one of up to 4 values in the Type Master (or will be auto-added if space).'],
      ['$ Savings', 'Negative values allowed (e.g. -50000).'],
      ['Owner', 'Use "None" for no owner. Must match Owner Directory for email links.'],
    ];
    const wsI = XLSX.utils.aoa_to_sheet(instr);
    wsI['!cols'] = [{ wch: 26 }, { wch: 80 }];
    if (wsI['A1']) wsI['A1'].s = { font: { bold: true, color: { rgb: '1F497D' }, sz: 13 } };
    XLSX.utils.book_append_sheet(wb, wsI, 'Instructions');

    XLSX.writeFile(wb, 'AI_Penetration_BulkUpload_Template.xlsx');
    showStatus('Template Downloaded ✓', 'success');
  } catch (err) {
    console.error('Template error:', err);
    alert('Failed to generate template.');
  }
}

// ==========================================
// DOWNLOAD XLS EXPORT
// ==========================================
function downloadXls() {
  try {
    const wb = XLSX.utils.book_new();
    const masterData = [[
      'Client Name', 'Region', 'Tower', 'Baseline FTE', 'Assessment Status', 'Agentic Potential FTE',
      'Client Approval for AI', 'Proposed Asset', 'Type', 'Estimated FTE Benefit',
      'Implementation Cost ($)', '$ Savings', 'Remaining Potential', 'Owner',
      'Actual Release %', 'Benchmark %', 'Variance %'
    ]];
    state.rows.forEach(row => {
      const rem = (row.pipelineFte || 0) - (row.estimatedFteBenefit || 0);
      const act = row.baseFte > 0 ? (row.pipelineFte / row.baseFte) * 100 : 0;
      masterData.push([
        row.client, row.region || '', row.tower, row.baseFte, row.assessment, row.pipelineFte,
        row.decision, row.initiative || '', row.initiativeType || '', row.estimatedFteBenefit || 0,
        row.implementationCost || 0, row.dollarSavings || 0, rem, row.owner || 'None',
        `${act.toFixed(1)}%`, `${row.benchmark}%`, `${(act - row.benchmark).toFixed(1)}%`
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(masterData), 'Master_Tracker');

    const assetHdr = ['Client Name', 'Region', 'Tower', 'Base FTE', ...state.assets, 'Future State FTE'];
    const assetData = [assetHdr];
    state.rows.forEach(row => {
      const arr = [row.client, row.region || '', row.tower, row.baseFte];
      let d = 0, p = 0, ip = 0;
      state.assets.forEach(a => {
        const cell = state.cellData[`${row.id}::${a}`] || { fte: '', status: 'Not Applicable' };
        const v = parseFloat(cell.fte || 0);
        if (cell.status === 'Deployed') d += v; else if (cell.status === 'Potential but lack CBA') p += v; else if (cell.status === 'In progress') ip += v;
        arr.push(cell.fte !== '' && cell.status !== 'Not Applicable' ? `${cell.fte} (${cell.status})` : '');
      });
      arr.push(row.baseFte - d - p - ip);
      assetData.push(arr);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assetData), 'Asset_Mapping');

    const dt = getFormattedDateTime();
    XLSX.writeFile(wb, `AI_Penetration_Report_${dt.dateTime}.xlsx`);
    showStatus('XLS Downloaded', 'success');
  } catch (err) {
    console.error('XLS error:', err);
    alert('Excel export failed.');
  }
}

// ==========================================
// DOWNLOAD PPT EXPORT
// ==========================================
function downloadPpt() {
  try {
    const pptx = new PptxGenJS();
    const slide1 = pptx.addSlide();
    slide1.background = { fill: '1F497D' };
    slide1.addText('AI Penetration & Opportunity Portfolio Dashboard', { x: 1, y: 2, w: 8, h: 1.5, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Outfit' });
    slide1.addText('Executive Savings & Financial Summary', { x: 1, y: 3.5, w: 8, h: 0.5, fontSize: 18, color: 'DCE6F1', fontFace: 'Outfit' });
    let totalBase = 0, totalPipe = 0, completedCount = 0, totalCost = 0, totalSavings = 0;
    state.rows.forEach(r => {
      totalBase += parseFloat(r.baseFte || 0); totalPipe += parseFloat(r.pipelineFte || 0);
      totalCost += parseFloat(r.implementationCost || 0); totalSavings += parseFloat(r.dollarSavings || 0);
      if (r.assessment === 'Completed') completedCount++;
    });
    const slide2 = pptx.addSlide();
    slide2.addText('Executive Portfolio Summary', { x: .5, y: .4, w: 9, h: .5, fontSize: 22, bold: true, color: '1F497D', fontFace: 'Outfit' });
    slide2.addTable([[
      { text: `Baseline Headcount\n${totalBase} FTE`, opts: { fontFace: 'Outfit', fontSize: 13, color: '1F497D', fill: 'F2F2F2', align: 'center' } },
      { text: `Agentic Potential FTE\n${totalPipe} FTE`, opts: { fontFace: 'Outfit', fontSize: 13, color: '1F497D', fill: 'F2F2F2', align: 'center' } },
      { text: `Implementation Cost\n$${totalCost.toLocaleString()}`, opts: { fontFace: 'Outfit', fontSize: 13, color: '1F497D', fill: 'F2F2F2', align: 'center' } },
      { text: `Annual Savings\n$${totalSavings.toLocaleString()}`, opts: { fontFace: 'Outfit', fontSize: 13, color: '1F497D', fill: 'F2F2F2', align: 'center' } }
    ]], { x: .5, y: 1.2, w: 9, h: 1 });
    slide2.addText(
      `Key Observations:\n- ${totalBase} baseline FTEs tracked.\n- ${totalPipe} FTE agentic potential identified.\n- $${totalSavings.toLocaleString()} savings targeted on $${totalCost.toLocaleString()} investment.\n- ${state.rows.length > 0 ? ((completedCount / state.rows.length) * 100).toFixed(0) : 0}% assessments completed.`,
      { x: .5, y: 2.5, w: 9, h: 2.5, fontSize: 12, fontFace: 'Outfit', color: '333333', lineSpacing: 22 }
    );
    const dt = getFormattedDateTime();
    pptx.writeFile({ fileName: `AI_Penetration_Portfolio_${dt.dateTime}.pptx` });
    showStatus('PPT Downloaded', 'success');
  } catch (err) {
    console.error('PPT error:', err);
    alert('PPT export failed.');
  }
}
