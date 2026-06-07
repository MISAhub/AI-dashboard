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
  clients: [],
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
let editingOwnerRowId = null;
let editingClientOwner = null;
let selectedPopoverStatus = 'Not Applicable';
let previousInputValues = {};
let lastServerSyncStr = "";

// Active filter state (shared across both tabs)
let filterState = { client: '', region: '', tower: '', assessment: '', initiative: '', type: '', status: '' };

// Sort state
let sortState = { col: null, dir: null };

// Sortable columns config: { key, label }
const SORTABLE_COLS = [
  { key: 'client', label: 'Client Name' },
  { key: 'region', label: 'Region' },
  { key: 'tower', label: 'Tower' },
  { key: 'baseFte', label: 'Baseline FTE' },
  { key: 'addressableFte', label: 'Addressable FTE' },
  { key: 'assessment', label: 'Assessment Status' },
  { key: 'pipelineFte', label: 'Agentic Potential FTE' },
  { key: 'decision', label: 'Client Approval for AI' },
  { key: 'initiative', label: 'Proposed Asset' },
  { key: 'initiativeType', label: 'Type' },
  { key: 'stack', label: 'Stack' },
  { key: 'estimatedFteBenefit', label: 'Est. FTE Benefit' },
  { key: 'realizedFte', label: 'Realized FTE' },
  { key: 'implementationCost', label: 'Impl. Cost ($)' },
  { key: 'dollarSavings', label: '$ Savings' },
  { key: '_remaining', label: 'Remaining Pot.' },
  { key: 'owner', label: 'Owner' },
  { key: '_aiPotentialPct', label: 'AI Potential %' },
  { key: '_actualPct', label: 'Benefit %' },
  { key: 'benchmark', label: 'Benchmark %' },
  { key: '_variance', label: 'Variance %' },
  { key: 'actionPlan', label: 'Action Plan' }
];

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadData();

  document.getElementById('saveBtn').addEventListener('click', () => saveData(true));
  document.getElementById('downloadXlsBtn').addEventListener('click', downloadXls);
  document.getElementById('downloadPptBtn').addEventListener('click', downloadPpt);
  document.getElementById('bulkUploadBtn').addEventListener('click', () => {
    document.getElementById('bulkUploadInput').click();
  });
  document.getElementById('bulkUploadInput').addEventListener('change', handleBulkUpload);
  document.getElementById('backupSelect').addEventListener('change', (e) => handleRestoreBackup(e.target.value));

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

  loadBackupsList();
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
      else if (activeTab === 'tab-client-summary') renderClientSummary();
      else if (activeTab === 'tab-leaderboard') renderLeaderboard();
      else renderInputTable();
    });
  });
}

// ==========================================
// DATA LOAD / SAVE
// ==========================================
function getApiUrl(path) {
  if (window.location.protocol === 'file:') {
    return 'http://localhost:3000' + path;
  }
  return path;
}

async function loadBackupsList() {
  try {
    const res = await fetch(getApiUrl('/api/backups'));
    if (!res.ok) return;
    const list = await res.json();
    const sel = document.getElementById('backupSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Load Saved State --</option>';
    list.forEach(b => {
      const o = document.createElement('option');
      o.value = b.name;
      o.textContent = b.label;
      sel.appendChild(o);
    });
  } catch (err) {
    console.error('Failed to load backups list:', err);
  }
}

async function handleRestoreBackup(fileName) {
  if (!fileName) return;
  if (!confirm(`Restore state to ${fileName}? This will overwrite the current configuration.`)) {
    document.getElementById('backupSelect').value = '';
    return;
  }
  try {
    const res = await fetch(getApiUrl('/api/restore'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName })
    });
    if (res.ok) {
      const result = await res.json();
      state = result.data;
      
      // Ensure defaults for loaded state
      if (!state.clients) state.clients = [];
      if (!state.assets) state.assets = [];
      if (!state.owners) state.owners = {};
      if (!state.rows) state.rows = [];
      if (!state.cellData) state.cellData = {};
      if (!state.towers || state.towers.length === 0) state.towers = ['PTP', 'RTR', 'OTC', 'FP&A'];
      if (!state.regions || state.regions.length === 0) state.regions = ['APAC', 'EMEA', 'Americas'];
      if (!state.initiativeTypes) state.initiativeTypes = [];
      if (!state.customInsights) state.customInsights = [];

      localStorage.setItem('ai_penetration_state', JSON.stringify(state));
      lastServerSyncStr = JSON.stringify({ rows: state.rows, cellData: state.cellData, assets: state.assets, owners: state.owners, towers: state.towers, regions: state.regions, initiativeTypes: state.initiativeTypes, customInsights: state.customInsights });
      
      showStatus('Restored successfully', 'success');
      renderInputTable();
      if (activeTab === 'tab-assets') renderAssetGrid();
      else if (activeTab === 'tab-insights') renderInsights();
      else if (activeTab === 'tab-client-summary') renderClientSummary();
      
      document.getElementById('backupSelect').value = '';
    } else {
      const errData = await res.json();
      alert('Failed to restore backup: ' + (errData.error || 'Server error'));
    }
  } catch (err) {
    console.error('Restore backup error:', err);
    alert('Failed to restore backup: ' + err.message);
  }
}

async function handleResetState() {
  if (!confirm("Are you sure you want to clear all contents from the table? This will make the dashboard completely blank.")) {
    return;
  }
  
  // Reset active configurations to blank
  state.rows = [];
  state.cellData = {};
  state.clients = [];
  state.assets = [];
  state.initiativeTypes = [];
  state.customInsights = [];
  
  localStorage.setItem('ai_penetration_state', JSON.stringify(state));
  
  showStatus('Connected (Unsaved Draft)', 'warning');
  
  // Re-render components
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
  else if (activeTab === 'tab-insights') renderInsights();
  else if (activeTab === 'tab-client-summary') renderClientSummary();
  
  const sel = document.getElementById('backupSelect');
  if (sel) sel.value = '';
}

async function loadData() {
  try {
    const res = await fetch(getApiUrl('/api/data?_cb=' + Date.now()));
    const loaded = await res.json();
    state = loaded;
    if (!state.clients) state.clients = [];
    if (!state.assets) state.assets = [];
    if (!state.owners) state.owners = {};
    if (!state.rows) state.rows = [];
    if (!state.cellData) state.cellData = {};
    if (!state.towers || state.towers.length === 0) state.towers = ['PTP', 'RTR', 'OTC', 'FP&A'];
    if (!state.regions || state.regions.length === 0) state.regions = ['APAC', 'EMEA', 'Americas'];
    if (!state.initiativeTypes) state.initiativeTypes = [];
    if (!state.customInsights) state.customInsights = [];

    state.rows.forEach(row => {
      if (row.baseFte === undefined) row.baseFte = '';
      if (row.addressableFte === undefined) row.addressableFte = '';
      if (row.pipelineFte === undefined) row.pipelineFte = '';
      if (row.estimatedFteBenefit === undefined) row.estimatedFteBenefit = '';
      if (row.realizedFte === undefined) row.realizedFte = '';
      if (row.implementationCost === undefined) row.implementationCost = '';
      if (row.dollarSavings === undefined) row.dollarSavings = '';
      if (!row.owner) row.owner = 'None';
      if (!row.region) row.region = '';
      if (row.decision === 'Pending Review') row.decision = '';
      if (!row.initiativeType) row.initiativeType = '';
      if (!row.stack) row.stack = '';
      if (row.actionPlan === undefined) row.actionPlan = '';
      if (row.clientActionPlan === undefined) row.clientActionPlan = '';
      
      // Auto-add client name to master if missing
      if (row.client && !state.clients.includes(row.client)) {
        state.clients.push(row.client);
      }
    });

    state.clients.sort((a, b) => a.localeCompare(b));

    lastServerSyncStr = JSON.stringify({ rows: state.rows, cellData: state.cellData, assets: state.assets, owners: state.owners, towers: state.towers, regions: state.regions, initiativeTypes: state.initiativeTypes, customInsights: state.customInsights });

    showStatus('Connected & Synced', 'success');
    renderInputTable();
    loadBackupsList();
  } catch (err) {
    console.error('Load error:', err);
    showStatus('Offline Mode (Local Storage)', 'warning');
    const local = localStorage.getItem('ai_penetration_state');
    if (local) { state = JSON.parse(local); renderInputTable(); }
  }
}

async function saveData(manual = false) {
  if (manual) {
    showStatus('Saving...', 'saving');
    try {
      const res = await fetch(getApiUrl('/api/data'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      if (res.ok) {
        showStatus('Saved & Synced', 'success');
        localStorage.setItem('ai_penetration_state', JSON.stringify(state));
        lastServerSyncStr = JSON.stringify({ rows: state.rows, cellData: state.cellData, assets: state.assets, owners: state.owners, towers: state.towers, regions: state.regions, initiativeTypes: state.initiativeTypes, customInsights: state.customInsights });
        downloadJsonState();
        loadBackupsList();
      } else throw new Error();
    } catch (err) {
      console.error('Failed to save state to server:', err);
      showStatus('Failed to save', 'error');
      localStorage.setItem('ai_penetration_state', JSON.stringify(state));
    }
  } else {
    localStorage.setItem('ai_penetration_state', JSON.stringify(state));
    showStatus('Connected (Unsaved Draft)', 'warning');
  }
}

async function pollServer() {
  if (document.hidden) return;
  const isEditing = document.activeElement && 
                    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') ||
                    document.getElementById('cellPopover').classList.contains('active');
  if (isEditing) return;

  try {
    const res = await fetch(getApiUrl('/api/data?_cb=' + Date.now()));
    if (!res.ok) return;
    const loaded = await res.json();
    const loadedStr = JSON.stringify({ rows: loaded.rows, cellData: loaded.cellData, assets: loaded.assets, owners: loaded.owners, towers: loaded.towers, regions: loaded.regions, initiativeTypes: loaded.initiativeTypes, customInsights: loaded.customInsights });
    
    if (loadedStr !== lastServerSyncStr) {
      state = loaded;
      lastServerSyncStr = loadedStr;
      if (activeTab === 'tab-insights') renderInsights();
      else if (activeTab === 'tab-assets') renderAssetGrid();
      else if (activeTab === 'tab-client-summary') renderClientSummary();
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
  if (d === 'In progress' || d === 'In Progress') return 'status-inprogress';
  if (d === 'Awaiting client approvals') return 'status-awaiting';
  if (d === 'Not Applicable' || d === 'Dropped') return 'status-na';
  return 'status-ideation';
}

function getAssessmentColorClass(val) {
  if (val === 'Completed') return 'assessment-completed';
  if (val === 'In Progress') return 'assessment-inprogress';
  return '';
}

function getPctColorClass(pctValue) {
  const p = pctValue * 100;
  if (p >= 50) return 'status-deployed';
  if (p >= 40) return 'status-inprogress';
  if (p >= 20) return 'status-awaiting';
  if (p >= 10) return 'status-potential';
  return '';
}

function getCellStatusClass(s) {
  if (s === 'Deployed') return 'deployed';
  if (s === 'Potential but lack CBA') return 'potential';
  if (s === 'In progress' || s === 'In Progress') return 'inprogress';
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
  return false;
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
  row.region = value;
  updateFilterDropdowns();
  renderInputTable();
  saveData();
}

// ==========================================
// FILTER STATE & FUNCTIONS
// ==========================================
function updateFilterDropdowns() {
  ['', '-grid'].forEach(sfx => {
    const cSel = document.getElementById(`filter-client${sfx}`);
    const rSel = document.getElementById(`filter-region${sfx}`);
    const tSel = document.getElementById(`filter-tower${sfx}`);
    const iSel = document.getElementById(`filter-initiative${sfx}`);
    const typeSel = document.getElementById(`filter-type${sfx}`);
    const statusSel = document.getElementById(`filter-status${sfx}`);

    if (cSel) {
      const curC = cSel.value;
      cSel.innerHTML = '<option value="">All Clients</option>';
      const sortedClients = [...state.clients].sort((a, b) => a.localeCompare(b));
      sortedClients.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        if (c === curC) o.selected = true;
        cSel.appendChild(o);
      });
    }

    if (rSel) {
      const curR = rSel.value;
      rSel.innerHTML = '<option value="">All Regions</option>';
      state.regions.forEach(r => {
        const o = document.createElement('option');
        o.value = r; o.textContent = r;
        if (r === curR) o.selected = true;
        rSel.appendChild(o);
      });
    }

    if (tSel) {
      const curT = tSel.value;
      tSel.innerHTML = '<option value="">All Towers</option>';
      state.towers.forEach(t => {
        const o = document.createElement('option');
        o.value = t; o.textContent = t;
        if (t === curT) o.selected = true;
        tSel.appendChild(o);
      });
    }

    if (iSel) {
      const curI = iSel.value;
      iSel.innerHTML = '<option value="">Asset</option>';
      state.assets.forEach(i => {
        const o = document.createElement('option');
        o.value = i; o.textContent = i;
        if (i === curI) o.selected = true;
        iSel.appendChild(o);
      });
    }

    if (typeSel) {
      const curType = typeSel.value;
      typeSel.innerHTML = '<option value="">All Types</option>';
      state.initiativeTypes.forEach(t => {
        const o = document.createElement('option');
        o.value = t; o.textContent = t;
        if (t === curType) o.selected = true;
        typeSel.appendChild(o);
      });
    }

    if (statusSel) {
      const curStatus = statusSel.value;
      statusSel.innerHTML = '<option value="">All Statuses</option>';
      const statuses = ['Ideation', 'Deployed', 'Potential but lack CBA', 'In progress', 'Awaiting client approvals', 'Dropped'];
      statuses.forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        if (s === curStatus) o.selected = true;
        statusSel.appendChild(o);
      });
    }
  });
}

function getActiveFilters() {
  const sfx = activeTab === 'tab-assets' ? '-grid' : '';
  return {
    client: (document.getElementById(`filter-client${sfx}`) || {}).value || '',
    region: (document.getElementById(`filter-region${sfx}`) || {}).value || '',
    tower: (document.getElementById(`filter-tower${sfx}`) || {}).value || '',
    assessment: (document.getElementById(`filter-assessment${sfx}`) || {}).value || '',
    initiative: (document.getElementById(`filter-initiative${sfx}`) || {}).value || '',
    type: (document.getElementById(`filter-type${sfx}`) || {}).value || '',
    status: (document.getElementById(`filter-status${sfx}`) || {}).value || '',
  };
}

function applyFilters() {
  const f = getActiveFilters();
  filterState = { ...f };

  ['', '-grid'].forEach(sfx => {
    const cSel = document.getElementById(`filter-client${sfx}`);
    const rSel = document.getElementById(`filter-region${sfx}`);
    const tSel = document.getElementById(`filter-tower${sfx}`);
    const aSel = document.getElementById(`filter-assessment${sfx}`);
    const iSel = document.getElementById(`filter-initiative${sfx}`);
    const typeSel = document.getElementById(`filter-type${sfx}`);
    const statusSel = document.getElementById(`filter-status${sfx}`);

    if (cSel) cSel.value = filterState.client;
    if (rSel) rSel.value = filterState.region;
    if (tSel) tSel.value = filterState.tower;
    if (aSel) aSel.value = filterState.assessment;
    if (iSel) iSel.value = filterState.initiative;
    if (typeSel) typeSel.value = filterState.type;
    if (statusSel) statusSel.value = filterState.status;
  });

  if (activeTab === 'tab-input') renderInputTable();
  else if (activeTab === 'tab-assets') renderAssetGrid();
}

function clearFilters() {
  filterState = { client: '', region: '', tower: '', assessment: '', initiative: '', type: '', status: '' };
  ['', '-grid'].forEach(sfx => {
    const cSel = document.getElementById(`filter-client${sfx}`);
    const rSel = document.getElementById(`filter-region${sfx}`);
    const tSel = document.getElementById(`filter-tower${sfx}`);
    const aSel = document.getElementById(`filter-assessment${sfx}`);
    const iSel = document.getElementById(`filter-initiative${sfx}`);
    const typeSel = document.getElementById(`filter-type${sfx}`);
    const statusSel = document.getElementById(`filter-status${sfx}`);

    if (cSel) cSel.value = '';
    if (rSel) rSel.value = '';
    if (tSel) tSel.value = '';
    if (aSel) aSel.value = '';
    if (iSel) iSel.value = '';
    if (typeSel) typeSel.value = '';
    if (statusSel) statusSel.value = '';
  });
  if (activeTab === 'tab-input') renderInputTable();
  else renderAssetGrid();
}

function getFilteredRows() {
  const f = filterState;
  return state.rows.filter(row => {
    if (f.client && row.client !== f.client) return false;
    if (f.region && row.region !== f.region) return false;
    if (f.tower && row.tower !== f.tower) return false;
    if (f.assessment && row.assessment !== f.assessment) return false;
    if (f.initiative && row.initiative !== f.initiative) return false;
    if (f.type && row.initiativeType !== f.type) return false;
    if (f.status) {
      const dec = row.decision || 'Ideation';
      if (dec !== f.status) return false;
    }
    return true;
  });
}


// Map to store custom column widths
let customColWidths = {};
try {
  const stored = localStorage.getItem('custom_col_widths');
  if (stored) customColWidths = JSON.parse(stored);
} catch (e) {}

function makeColumnResizable(th, widthKey) {
  if (!th.querySelector('.resize-handle')) {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    th.appendChild(handle);
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      th.classList.add('resizing');
      
      const onMouseMove = (moveEvent) => {
        const newWidth = Math.max(25, startWidth + (moveEvent.pageX - startX));
        th.style.width = `${newWidth}px`;
        th.style.minWidth = `${newWidth}px`;
        th.style.maxWidth = `${newWidth}px`;
        
        customColWidths[widthKey] = newWidth;
        localStorage.setItem('custom_col_widths', JSON.stringify(customColWidths));
      };
      
      const onMouseUp = () => {
        th.classList.remove('resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
  
  if (customColWidths[widthKey]) {
    const w = customColWidths[widthKey];
    th.style.width = `${w}px`;
    th.style.minWidth = `${w}px`;
    th.style.maxWidth = `${w}px`;
  }
}

function getRowAddressableFte(row) {
  if (row.addressableFte !== undefined && row.addressableFte !== '') {
    return parseFloat(row.addressableFte) || 0;
  }
  return 0;
}

function getClientTowerAddressable(client, tower) {
  const clientRows = state.rows.filter(r => 
    r.client && r.tower && 
    r.client.trim().toLowerCase() === client.trim().toLowerCase() && 
    r.tower.trim().toLowerCase() === tower.trim().toLowerCase()
  );
  return clientRows.reduce((sum, r) => sum + getRowAddressableFte(r), 0);
}

function getMaxBaseFteForClientTower(client, tower, proposedRowId, proposedBase) {
  let maxBase = 0;
  state.rows.forEach(r => {
    if (r.client && r.tower && r.client.trim().toLowerCase() === client.trim().toLowerCase() && r.tower.trim().toLowerCase() === tower.trim().toLowerCase()) {
      let b = r.id === proposedRowId && proposedBase !== undefined ? proposedBase : r.baseFte;
      const val = parseFloat(b) || 0;
      if (val > maxBase) maxBase = val;
    }
  });
  return maxBase;
}

function validateClientTowerFteConstraint(client, tower, proposedRowId, proposedAddressable, proposedBase) {
  if (!client || !tower) return true;
  
  const clientRows = state.rows.filter(r => 
    r.client && r.tower && 
    r.client.trim().toLowerCase() === client.trim().toLowerCase() && 
    r.tower.trim().toLowerCase() === tower.trim().toLowerCase()
  );
  
  const anySpecified = clientRows.some(r => {
    let addr = r.id === proposedRowId ? proposedAddressable : r.addressableFte;
    return addr !== undefined && addr !== '';
  });
  
  if (!anySpecified) {
    return true; // Bypass validation if all blanks
  }
  
  let sumAddressable = 0;
  let maxBase = 0;
  
  clientRows.forEach(r => {
    let addr = r.id === proposedRowId ? proposedAddressable : r.addressableFte;
    if (addr !== undefined && addr !== '') {
      sumAddressable += parseFloat(addr) || 0;
    }
    
    let base = r.id === proposedRowId && proposedBase !== undefined ? proposedBase : r.baseFte;
    const valBase = parseFloat(base) || 0;
    if (valBase > maxBase) maxBase = valBase;
  });
  
  return sumAddressable <= maxBase;
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
      va = (a.pipelineFte || 0) > 0 ? (a.estimatedFteBenefit || 0) / (a.pipelineFte || 0) : 0;
      vb = (b.pipelineFte || 0) > 0 ? (b.estimatedFteBenefit || 0) / (b.pipelineFte || 0) : 0;
    } else if (sortState.col === '_variance') {
      va = ((a.pipelineFte || 0) > 0 ? (a.estimatedFteBenefit || 0) / (a.pipelineFte || 0) : 0) - (a.benchmark || 0) / 100;
      vb = ((b.pipelineFte || 0) > 0 ? (b.estimatedFteBenefit || 0) / (b.pipelineFte || 0) : 0) - (b.benchmark || 0) / 100;
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
    if (col.key === 'actionPlan') return;
    const th = document.createElement('th');
    th.style.whiteSpace = 'nowrap';
    const isSortable = sortableCols.has(col.key);
    const isActive = sortState.col === col.key;
    const arrow = isActive ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '';
    th.innerHTML = isSortable
      ? `<span class="sort-header" onclick="handleSort('${col.key}')" title="Sort by ${col.label}">${escHtml(col.label)}${arrow}</span>`
      : escHtml(col.label);
    if (isActive) th.classList.add('sort-active');
    tr.appendChild(th);
    makeColumnResizable(th, 'input-' + col.key);
  });

  const thAct = document.createElement('th');
  thAct.style.width = '50px';
  thAct.textContent = 'Action';
  tr.appendChild(thAct);
  makeColumnResizable(thAct, 'input-action');

  const actionPlanCol = SORTABLE_COLS.find(c => c.key === 'actionPlan');
  if (actionPlanCol) {
    const thAP = document.createElement('th');
    thAP.style.whiteSpace = 'nowrap';
    thAP.innerHTML = escHtml(actionPlanCol.label);
    tr.appendChild(thAP);
    makeColumnResizable(thAP, 'input-' + actionPlanCol.key);
  }
}

// ==========================================
// RENDER TAB 1: INPUT TABLE
// ==========================================
function renderInputTable() {
  renderInputTableHeader();
  updateFilterDropdowns();

  const tbody = document.getElementById('inputTableBody');
  tbody.innerHTML = '';

  let totalBaseline = 0, totalAddressable = 0, totalPipeline = 0, totalSavings = 0, totalCost = 0, totalRealized = 0, totalEstBenefit = 0;
  let sumBenchmark = 0, countRows = 0;

  const rows = getSortedRows();

  // Filter count display
  const countEl = document.getElementById('filterCount');
  const isFiltered = Object.values(filterState).some(v => v !== '');
  if (countEl) { countEl.textContent = isFiltered ? `${rows.length} of ${state.rows.length} rows` : ''; countEl.style.color = isFiltered ? '#c62828' : ''; }

  rows.forEach(row => {
    const rowId = row.id;
    const active = isAssessmentActive(row.assessment);
    const baseVal = row.baseFte === '' ? 0 : parseFloat(row.baseFte || 0);
    const addrVal = getRowAddressableFte(row);
    const pipeVal = row.pipelineFte === '' ? 0 : parseFloat(row.pipelineFte || 0);
    const benVal = row.estimatedFteBenefit === '' ? 0 : parseFloat(row.estimatedFteBenefit || 0);
    const realizedVal = row.realizedFte === '' ? 0 : parseFloat(row.realizedFte || 0);
    const costVal = row.implementationCost === '' ? 0 : parseFloat(row.implementationCost || 0);
    const savingsVal = row.dollarSavings === '' ? 0 : parseFloat(row.dollarSavings || 0);
    
    const remainingPotential = (row.pipelineFte === '' ? 0 : parseFloat(row.pipelineFte)) - (row.estimatedFteBenefit === '' ? 0 : parseFloat(row.estimatedFteBenefit));

    totalBaseline += baseVal;
    totalAddressable += addrVal;
    totalPipeline += pipeVal;
    totalSavings += savingsVal;
    totalCost += costVal;
    totalRealized += realizedVal;
    totalEstBenefit += benVal;

    if (row.benchmark !== undefined && row.benchmark !== '') {
      sumBenchmark += parseFloat(row.benchmark) || 0;
      countRows++;
    }

    const actualPct = pipeVal > 0 ? (benVal / pipeVal) : 0;
    const benchmarkPct = (row.benchmark || 0) / 100;
    const variance = actualPct - benchmarkPct;

    // Client dropdown options
    let clientOpts = `<option value="" ${!row.client ? 'selected' : ''}>-- Select Client --</option>`;
    state.clients.forEach(c => {
      clientOpts += `<option value="${escHtml(c)}" ${row.client === c ? 'selected' : ''}>&nbsp;&nbsp;${escHtml(c)}</option>`;
    });

    // Region dropdown options
    const regionOpts = `<option value="" ${!row.region ? 'selected' : ''}>-- Select Region --</option>` +
      state.regions.map(r =>
        `<option value="${escHtml(r)}" ${row.region === r ? 'selected' : ''}>${escHtml(r)}</option>`
      ).join('');

    // Tower dropdown options
    const towerOpts = `<option value="" ${!row.tower ? 'selected' : ''}>-- Select Tower --</option>` +
      state.towers.map(t =>
        `<option value="${escHtml(t)}" ${row.tower === t ? 'selected' : ''}>${escHtml(t)}</option>`
      ).join('');

    // Client Approval options
    const decisionOpts = ['', 'Deployed', 'Potential but lack CBA', 'In progress', 'Awaiting client approvals', 'Dropped'].map(v =>
      `<option value="${v}" ${row.decision === v ? 'selected' : ''}>${v === '' ? 'Select' : v}</option>`
    ).join('');

    // Proposed Asset select options
    let assetOpts = `<option value="" ${!row.initiative ? 'selected' : ''}>-- Select Asset --</option>`;
    state.assets.forEach(a => {
      assetOpts += `<option value="${escHtml(a)}" ${row.initiative === a ? 'selected' : ''}>${escHtml(a)}</option>`;
    });
    assetOpts += `<option value="__custom__">+ Enter Custom Asset...</option>`;

    // Initiative Type dropdown
    const typeOpts = [`<option value="" ${!row.initiativeType ? 'selected' : ''}>-- Select Type --</option>`,
    ...state.initiativeTypes.map(t => `<option value="${escHtml(t)}" ${row.initiativeType === t ? 'selected' : ''}>${escHtml(t)}</option>`)
    ].join('');

    // Owner cell content (Pencil Swap & Direct mail)
    let ownerCellContent = '';
    const ownerName = row.owner || 'None';
    const ownerEmail = state.owners[ownerName] || '';
    
    if (editingOwnerRowId === rowId) {
      let ownerOpts = `<option value="None" ${ownerName === 'None' ? 'selected' : ''}>None</option>`;
      Object.keys(state.owners).forEach(n => {
        ownerOpts += `<option value="${escHtml(n)}" ${ownerName === n ? 'selected' : ''}>${escHtml(n)}</option>`;
      });
      ownerCellContent = `
        <select onchange="handleOwnerDropdownChange('${rowId}', this.value)" style="width: 100px;">
          ${ownerOpts}
        </select>
        <button class="owner-edit-btn" onclick="cancelOwnerEdit()" title="Cancel">✕</button>
      `;
    } else {
      let emailAnchor = '';
      if (ownerEmail && ownerName !== 'None') {
        const rem = pipeVal - benVal;
        const subj = encodeURIComponent(`AI Penetration Status Update - ${row.client || 'Client'} [${row.tower || 'Tower'}]`);
        const body = encodeURIComponent(`Hi ${ownerName},\n\nHere is the current AI Penetration dashboard metrics for ${row.client || 'Client'} - ${row.tower || 'Tower'}:\n\n- Baseline FTE: ${row.baseFte || 0}\n- Addressable FTE: ${row.addressableFte || 0}\n- Assessment Status: ${row.assessment || 'Not Started'}\n- AI Potential FTE: ${row.pipelineFte || 0}\n- Client Approval Status: ${row.decision || 'Ideation'}\n- Proposed Asset: ${row.initiative || 'None'}\n- Asset Type: ${row.initiativeType || 'None'}\n- Est. FTE Benefit: ${row.estimatedFteBenefit || 0}\n- Implementation Cost: ${(row.implementationCost || 0).toLocaleString()}\n- Annual $ Savings: ${(row.dollarSavings || 0).toLocaleString()}\n- Remaining Potential FTE: ${rem || 0}\n- Stack: ${row.stack || 'None'}\n\nPlease review and let us know if there are any updates.\n\nRegards`);
        emailAnchor = `<a href="mailto:${ownerEmail}?subject=${subj}&body=${body}" class="owner-email-icon-btn" title="Email ${ownerName}">✉</a>`;
      }
      
      ownerCellContent = `
        <span class="owner-name-text" style="font-size:9.5px;max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(ownerName)}</span>
        ${emailAnchor}
        <button class="owner-edit-btn" onclick="startOwnerEdit('${rowId}')" title="Edit Owner">✎</button>
      `;
    }

    // Calculations
    const aiPotentialPct = addrVal > 0 ? (pipeVal / addrVal) : 0;
    const benefitPct = pipeVal > 0 ? (benVal / pipeVal) : 0;

    // Conditional formats classes
    const aiPotentialClass = getPctColorClass(aiPotentialPct);
    const benefitClass = getPctColorClass(benefitPct);

    const dis = active ? '' : 'disabled';
    const savCol = savingsVal < 0 ? 'color:#c62828;font-weight:700;' : savingsVal > 0 ? 'color:#2e7d32;font-weight:700;' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select onchange="handleClientChange('${rowId}', this.value)" class="editable-cell-select" style="font-weight: 600;">
          ${clientOpts}
        </select>
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
        <input type="number" min="0" step="1" value="${row.addressableFte}"
          onchange="handleAddressableFteChange('${rowId}', this)" style="width:48px;">
      </td>
      <td>
        <select class="assessment-select ${getAssessmentColorClass(row.assessment)}" onchange="handleAssessmentChange('${rowId}', this.value)">
          <option value="Not Started" ${row.assessment === 'Not Started' ? 'selected' : ''}>Not Started</option>
          <option value="In Progress" ${row.assessment === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Completed"   ${row.assessment === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="No Scale"    ${row.assessment === 'No Scale' ? 'selected' : ''}>No Scale</option>
        </select>
      </td>
      <td>
        <input type="number" min="0" step="1" value="${row.pipelineFte}"
          onchange="handlePipelineFteChange('${rowId}', this)" style="width:50px;" ${dis}>
      </td>
      <td>
        <select class="decision-select ${getDecisionColorClass(row.decision)}"
          onchange="handleDecisionDropdownChange('${rowId}', this.value)" ${dis}>
          ${decisionOpts}
        </select>
      </td>
      <td>
        <select onchange="handleProposedAssetChange('${rowId}', this.value)" class="editable-cell-select" ${dis}>
          ${assetOpts}
        </select>
      </td>
      <td>
        <select ${dis} onchange="updateRowField('${rowId}', 'initiativeType', this.value)">
          ${typeOpts}
        </select>
      </td>
      <td>
        <input type="text" value="${escHtml(row.stack || '')}" style="width:65px;" ${dis}
          onchange="updateRowField('${rowId}', 'stack', this.value.trim())" placeholder="Stack">
      </td>
      <td>
        <input type="number" min="0" step="0.5" value="${row.estimatedFteBenefit}"
          onchange="handleFteBenefitChange('${rowId}', this.value)" style="width:55px;" ${dis}>
      </td>
      <td>
        <input type="number" min="0" step="0.5" value="${row.realizedFte || ''}"
          onchange="handleRealizedFteChange('${rowId}', this)" style="width:55px;" ${dis}>
      </td>
      <td>
        <input type="number" min="0" value="${row.implementationCost}"
          onchange="updateRowField('${rowId}', 'implementationCost', this.value===''?'':(parseFloat(this.value)||0))" style="width:70px;" ${dis}>
      </td>
      <td>
        <input type="number" value="${row.dollarSavings}" style="width:75px;${savCol}"
          onchange="handleSavingsChange('${rowId}', this)" ${dis}>
      </td>
      <td class="col-num" style="font-weight:600;">${remainingPotential}</td>
      <td>
        <div class="owner-cell-container" style="display:flex;align-items:center;gap:4px;">
          ${ownerCellContent}
        </div>
      </td>
      <td class="col-num ${aiPotentialClass}" ${aiPotentialClass === 'status-potential' ? 'style="color:#276a3c;font-weight:600;"' : (aiPotentialClass ? 'style="color:#fff;font-weight:600;"' : '')}>${(aiPotentialPct * 100).toFixed(1)}%</td>
      <td class="col-num ${benefitClass}" ${benefitClass === 'status-potential' ? 'style="color:#276a3c;font-weight:600;"' : (benefitClass ? 'style="color:#fff;font-weight:600;"' : '')}>${(benefitPct * 100).toFixed(1)}%</td>
      <td>
        <input type="number" min="0" max="100" value="${row.benchmark || 20}"
          onchange="updateRowField('${rowId}', 'benchmark', parseFloat(this.value)||0)" style="width:45px;" ${dis}>%
      </td>
      <td class="col-num ${variance >= 0 ? 'val-positive' : 'val-negative'}">
        ${variance >= 0 ? '+' : ''}&nbsp;${(variance * 100).toFixed(1)}%
      </td>
      <td class="col-center">
        <button class="btn btn-sm btn-danger" onclick="handleDeleteRow('${rowId}')">Delete</button>
      </td>
      <td>
        <input type="text" value="${escHtml(row.actionPlan || '')}" style="width: 100%; box-sizing: border-box;" ${dis}
          onchange="handleRowActionPlanChange('${rowId}', this)" placeholder="Action plan">
      </td>
    `;
    tbody.appendChild(tr);

    if (!active) {
      tr.querySelectorAll('input[disabled], select[disabled]').forEach(el => {
        el.style.background = '#f0f0f0';
        el.style.color = '#aaa';
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.55';
      });
    }

    const savInput = tr.querySelector(`input[onchange*="handleSavingsChange"]`);
    if (savInput) {
      savInput.style.color = savingsVal < 0 ? '#c62828' : savingsVal > 0 ? '#2e7d32' : '';
      savInput.style.fontWeight = savingsVal !== 0 ? '700' : '';
    }
  });

  // Totals footer
  const tfoot = document.getElementById('inputTableTotals');
  const savCol = totalSavings < 0 ? 'color:#c62828;' : totalSavings > 0 ? 'color:#2e7d32;' : '';
  
  const totalBenefitPct = totalPipeline > 0 ? (totalEstBenefit / totalPipeline) : 0;
  const totalVariance = totalBenefitPct - (countRows > 0 ? (sumBenchmark / countRows) / 100 : 0.20);

  tfoot.innerHTML = `
    <td colspan="3">TOTAL PORTFOLIO</td>
    <td class="col-num">${totalBaseline}</td>
    <td class="col-num">${totalAddressable}</td>
    <td></td>
    <td class="col-num">${totalPipeline}</td>
    <td colspan="5"></td>
    <td class="col-num">${totalRealized}</td>
    <td class="col-num">${totalCost.toLocaleString()}</td>
    <td class="col-num" style="${savCol}">${totalSavings.toLocaleString()}</td>
    <td colspan="2"></td>
    <td class="col-num">${totalBaseline > 0 ? ((totalPipeline / totalBaseline) * 100).toFixed(1) : '0.0'}%</td>
    <td colspan="2"></td>
    <td class="col-num ${totalVariance >= 0 ? 'val-positive' : 'val-negative'}">${totalVariance >= 0 ? '+' : ''}${(totalVariance * 100).toFixed(1)}%</td>
    <td></td>
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

function handleClientChange(rowId, val) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  
  if (val) {
    const towersForClient = new Set(state.rows.filter(r => r.client.toLowerCase() === val.toLowerCase() && r.id !== rowId).map(r => r.tower));
    if (row.tower) towersForClient.add(row.tower);
    if (towersForClient.size > 8) {
      alert(`Client "${val}" already has ${towersForClient.size} towers (maximum 8 unique towers per client).`);
      renderInputTable();
      return;
    }
  }
  
  row.client = val;
  renderInputTable();
  saveData();
}

function handleTowerChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  
  if (row.client) {
    const towersForClient = new Set(state.rows.filter(r => r.client.toLowerCase() === row.client.toLowerCase() && r.id !== rowId).map(r => r.tower));
    if (value) towersForClient.add(value);
    if (towersForClient.size > 8) {
      alert(`Client "${row.client}" already has ${towersForClient.size} towers (maximum 8 unique towers per client).`);
      renderInputTable();
      return;
    }
  }

  row.tower = value;
  if (!row.benchmark) row.benchmark = getTowerBenchmark(value);
  renderInputTable();
  saveData();
}

function handleBaseFteChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const valStr = input.value.trim();
  if (valStr === '') {
    row.baseFte = '';
    renderInputTable();
    saveData();
    return;
  }
  let val = parseInt(valStr, 10);
  if (isNaN(val) || val < 0) {
    alert('Baseline FTE must be a whole number ≥ 0 or blank.');
    input.value = row.baseFte;
    return;
  }
  
  if (row.addressableFte !== '' && val < parseFloat(row.addressableFte)) {
    alert(`Baseline FTE (${val}) cannot be less than Addressable FTE (${row.addressableFte}).`);
    input.value = row.baseFte;
    return;
  }
  
  if (row.pipelineFte !== '' && val < parseFloat(row.pipelineFte || 0)) {
    alert(`Baseline FTE (${val}) cannot be less than Agentic Potential FTE (${row.pipelineFte}).`);
    input.value = row.baseFte;
    return;
  }
  
  if (!validateClientTowerFteConstraint(row.client, row.tower, rowId, undefined, val)) {
    alert(`Validation Error: The sum of Addressable FTEs would exceed the maximum Baseline FTE (${val}) for this Client + Tower.`);
    input.value = row.baseFte;
    return;
  }
  
  row.baseFte = val;
  renderInputTable();
  saveData();
}

function handleAddressableFteChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const valStr = input.value.trim();
  if (valStr === '') {
    row.addressableFte = '';
    renderInputTable();
    saveData();
    return;
  }
  const val = parseFloat(valStr);
  if (isNaN(val) || val < 0) {
    alert('Addressable FTE must be a positive number or left blank.');
    input.value = row.addressableFte;
    return;
  }
  
  const baseVal = row.baseFte === '' ? 0 : parseFloat(row.baseFte);
  if (val > baseVal) {
    alert(`Addressable FTE (${val}) cannot exceed Baseline FTE (${baseVal}).`);
    input.value = row.addressableFte;
    return;
  }
  
  const pipeVal = row.pipelineFte === '' ? 0 : parseFloat(row.pipelineFte);
  if (val < pipeVal) {
    alert(`Addressable FTE (${val}) cannot be less than AI Potential FTE (${pipeVal}).`);
    input.value = row.addressableFte;
    return;
  }
  
  if (!validateClientTowerFteConstraint(row.client, row.tower, rowId, valStr, undefined)) {
    alert(`Validation Error: The sum of Addressable FTEs for this Client + Tower combination cannot exceed the maximum Baseline FTE (${getMaxBaseFteForClientTower(row.client, row.tower, rowId, undefined)}).`);
    input.value = row.addressableFte;
    return;
  }
  
  row.addressableFte = val;
  renderInputTable();
  saveData();
}

function handlePipelineFteChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const valStr = input.value.trim();
  if (valStr === '') {
    row.pipelineFte = '';
    renderInputTable();
    saveData();
    return;
  }
  let val = parseFloat(valStr) || 0;
  if (val < 0) { alert('Agentic Potential FTE cannot be negative.'); input.value = row.pipelineFte || 0; return; }
  
  const addrVal = row.addressableFte === '' ? (row.baseFte === '' ? 0 : parseFloat(row.baseFte)) : parseFloat(row.addressableFte);
  if (val > addrVal) {
    alert(`AI Potential FTE (${val}) cannot exceed Addressable FTE (${addrVal}).`);
    input.value = row.pipelineFte || 0;
    return;
  }
  
  if (row.realizedFte !== '' && val < parseFloat(row.realizedFte)) {
    alert(`AI Potential FTE (${val}) cannot be less than Realized FTE (${row.realizedFte}).`);
    input.value = row.pipelineFte || '';
    return;
  }
  if (row.estimatedFteBenefit !== '' && val < parseFloat(row.estimatedFteBenefit)) {
    alert(`AI Potential FTE (${val}) cannot be less than Est. FTE Benefit (${row.estimatedFteBenefit}).`);
    input.value = row.pipelineFte || '';
    return;
  }
  
  row.pipelineFte = val;
  renderInputTable();
  saveData();
}

function handleRealizedFteChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const valStr = input.value.trim();
  if (valStr === '') {
    row.realizedFte = '';
    renderInputTable();
    saveData();
    return;
  }
  const val = parseFloat(valStr);
  if (isNaN(val) || val < 0) {
    alert('Realized FTE must be a positive number or left blank.');
    input.value = row.realizedFte || '';
    return;
  }
  
  const pipeVal = row.pipelineFte === '' ? 0 : parseFloat(row.pipelineFte || 0);
  if (val > pipeVal) {
    alert(`Realized FTE (${val}) cannot exceed AI Potential FTE (${pipeVal}).`);
    input.value = row.realizedFte || '';
    return;
  }
  
  row.realizedFte = val;
  renderInputTable();
  saveData();
}

function handleFteBenefitChange(rowId, valStr) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const valTrim = valStr.trim();
  if (valTrim === '') {
    row.estimatedFteBenefit = '';
    if (row.initiative) {
      const cellId = `${rowId}::${row.initiative}`;
      if (state.cellData[cellId]) {
        state.cellData[cellId].fte = 0;
      }
    }
    renderInputTable();
    saveData();
    return;
  }
  const val = parseFloat(valTrim);
  if (isNaN(val) || val < 0) {
    alert('Estimated FTE Benefit must be a positive number or left blank.');
    renderInputTable();
    return;
  }
  const pipeVal = row.pipelineFte === '' ? 0 : parseFloat(row.pipelineFte || 0);
  if (val > pipeVal) {
    alert(`Est. FTE Benefit (${val}) cannot exceed AI Potential FTE (${pipeVal}).`);
    renderInputTable();
    return;
  }
  row.estimatedFteBenefit = val;
  if (row.initiative) {
    const cellId = `${rowId}::${row.initiative}`;
    if (!state.cellData[cellId]) {
      state.cellData[cellId] = { fte: val, status: row.decision || 'Not Applicable' };
    } else {
      state.cellData[cellId].fte = val;
    }
  }
  renderInputTable();
  saveData();
}

function handleAssessmentChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (row) row.assessment = value;
  renderInputTable();
  saveData();
}

function updateRowField(rowId, field, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (row) row[field] = value;
  renderInputTable();
  saveData();
}

function handleSavingsChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const valStr = input.value.trim();
  if (valStr === '') {
    row.dollarSavings = '';
    saveData();
    return;
  }
  const val = parseFloat(valStr) || 0;
  row.dollarSavings = val;
  input.style.color = val < 0 ? '#c62828' : val > 0 ? '#2e7d32' : '';
  input.style.fontWeight = val !== 0 ? '700' : '';
  saveData();
}

function handleDecisionDropdownChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  row.decision = value;
  
  // Sync the cellData for this row's proposed asset if initiative is set
  if (row.initiative) {
    const cellId = `${rowId}::${row.initiative}`;
    if (state.cellData[cellId]) {
      state.cellData[cellId].status = value || 'Not Applicable';
    } else {
      state.cellData[cellId] = { fte: row.estimatedFteBenefit || 0, status: value || 'Not Applicable' };
    }
  }
  
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
  saveData();
}

function handleProposedAssetChange(rowId, val) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  
  if (val === '__custom__') {
    const customAsset = prompt('Enter new custom asset name:');
    if (customAsset === null) {
      renderInputTable();
      return;
    }
    const cleanAsset = customAsset.trim();
    if (!cleanAsset) {
      alert('Asset name cannot be blank.');
      renderInputTable();
      return;
    }
    if (state.assets.includes(cleanAsset)) {
      alert('Asset already exists.');
      row.initiative = cleanAsset;
    } else {
      if (state.assets.length >= 100) {
        alert('Max 100 assets reached.');
        renderInputTable();
        return;
      }
      state.assets.push(cleanAsset);
      row.initiative = cleanAsset;
    }
  } else {
    row.initiative = val;
  }
  
  if (row.initiative) {
    const cellId = `${rowId}::${row.initiative}`;
    if (!state.cellData[cellId]) {
      state.cellData[cellId] = { fte: row.estimatedFteBenefit || 0, status: row.decision || 'Not Applicable' };
    }
  }
  
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
  saveData();
}

function startOwnerEdit(rowId) {
  editingOwnerRowId = rowId;
  renderInputTable();
}

function cancelOwnerEdit() {
  editingOwnerRowId = null;
  renderInputTable();
}

function handleOwnerDropdownChange(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (row) {
    row.owner = value;
  }
  editingOwnerRowId = null;
  renderInputTable();
  saveData();
}

function startClientOwnerEdit(client) {
  editingClientOwner = client;
  renderClientSummary();
}

function cancelClientOwnerEdit() {
  editingClientOwner = null;
  renderClientSummary();
}

function handleClientOwnerChange(client, selectedOwner) {
  const clientRows = state.rows.filter(r => r.client && r.client.trim().toLowerCase() === client.trim().toLowerCase());
  clientRows.forEach(r => r.owner = selectedOwner);
  editingClientOwner = null;
  renderClientSummary();
  renderInputTable();
  saveData();
}

function handleRowActionPlanChange(rowId, input) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  const val = input.value.trim();
  const words = val.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 35) {
    alert(`Action plan exceeds the limit of 35 words (current: ${words.length} words).`);
    input.value = row.actionPlan || '';
    return;
  }
  row.actionPlan = val;
  saveData();
}

function handleClientActionPlanChange(client, input) {
  const val = input.value.trim();
  const words = val.split(/\s+/).filter(w => w.length > 0);
  const clientRows = state.rows.filter(r => r.client && r.client.trim().toLowerCase() === client.trim().toLowerCase());
  if (words.length > 35) {
    alert(`Action plan exceeds the limit of 35 words (current: ${words.length} words).`);
    input.value = clientRows[0]?.clientActionPlan || '';
    return;
  }
  clientRows.forEach(r => r.clientActionPlan = val);
  saveData();
}

// ==========================================
// INITIATIVE AUTOCOMPLETE (Unused now, but kept for compatibility)
// ==========================================
function showInitiativeSuggestions(rowId, inputEl) {}

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
  state.rows.push({
    id: `row_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    client: '',
    region: '',
    tower: '',
    baseFte: '',
    addressableFte: '',
    assessment: 'Not Started',
    pipelineFte: '',
    decision: '',
    initiative: '',
    initiativeType: '',
    estimatedFteBenefit: '',
    realizedFte: '',
    implementationCost: '',
    dollarSavings: '',
    benchmark: 20,
    owner: 'None',
    stack: '',
    actionPlan: '',
    clientActionPlan: ''
  });
  renderInputTable();
  saveData();
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
  headerRow.innerHTML = '';

  // Create base headers
  const baseHeaders = [
    { label: 'Client Name', key: 'grid-client' },
    { label: 'Region', key: 'grid-region' },
    { label: 'Tower', key: 'grid-tower' },
    { label: 'Base FTE', key: 'grid-baseFte' }
  ];

  baseHeaders.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h.label;
    headerRow.appendChild(th);
    makeColumnResizable(th, h.key);
  });

  // Create Asset headers
  const rotateHeaders = document.getElementById('rotateHeadersCheckbox')?.checked;
  state.assets.forEach(asset => {
    const th = document.createElement('th');
    th.className = 'col-center asset-header-th'; // Accenture digital blue header
    
    if (rotateHeaders) {
      th.classList.add('rotated-header');
      const inner = document.createElement('div');
      inner.className = 'rotated-header-content';
      inner.textContent = asset;
      th.appendChild(inner);
    } else {
      th.textContent = asset;
    }
    
    headerRow.appendChild(th);
    makeColumnResizable(th, 'grid-asset-' + asset);
  });

  // Future State FTE header
  const thF = document.createElement('th');
  thF.className = 'col-center col-future-header';
  thF.textContent = 'Future State FTE';
  headerRow.appendChild(thF);
  makeColumnResizable(thF, 'grid-future');

  const tbody = document.getElementById('gridBody');
  tbody.innerHTML = '';

  // Apply filters and exclude Not Started & No Scale
  let filteredRows = getFilteredRows();
  filteredRows = filteredRows.filter(r => r.assessment !== 'Not Started' && r.assessment !== 'No Scale');

  filteredRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(row.client || '')}</strong></td>
      <td>${escHtml(row.region || '')}</td>
      <td><strong>${escHtml(row.tower || '')}</strong></td>
      <td class="col-num">${row.baseFte || 0}</td>
    `;

    let deployed = 0, potential = 0, inprog = 0;
    state.assets.forEach(asset => {
      const cellId = `${row.id}::${asset}`;
      const cell = state.cellData[cellId] || { fte: '', status: 'Not Applicable' };
      const fteVal = parseFloat(cell.fte || 0);
      if (cell.status === 'Deployed') deployed += fteVal;
      else if (cell.status === 'Potential but lack CBA') potential += fteVal;
      else if (cell.status === 'In progress' || cell.status === 'In Progress') inprog += fteVal;

      const td = document.createElement('td');
      td.className = `asset-cell status-${getCellStatusClass(cell.status)}`;
      td.textContent = cell.fte !== '' && cell.status !== 'Not Applicable' ? cell.fte : '';
      td.onclick = (e) => openCellPopover(e, row.id, asset);
      tr.appendChild(td);
    });

    const baseVal = row.baseFte === '' ? 0 : parseFloat(row.baseFte || 0);
    const future = baseVal - deployed - potential - inprog;
    const tdF = document.createElement('td');
    tdF.className = 'col-future-cell';
    tdF.textContent = future;
    tr.appendChild(tdF);
    tbody.appendChild(tr);
  });
}

function toggleHeaderRotation(checked) {
  renderAssetGrid();
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
  saveData();
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
  renderBillingTypeChart();
  renderBenefitByAssetChart();

  // ---- Insights list ----
  renderInsightsList(towerStats, totalBaseline, totalPipeline, approvedCount, completedCount, pen);
}

// Inline plugin for displaying value labels inside or on top of chart elements
const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta && meta.data) {
        meta.data.forEach((element, index) => {
          const dataVal = dataset.data[index];
          if (dataVal === undefined || dataVal === null || dataVal === 0 || dataVal === "0" || dataVal === "0.0") return;

          ctx.fillStyle = '#333';
          ctx.font = 'bold 8.5px Outfit';

          let label = dataVal.toString();

          // Check if chart displays percentages
          const isTowerChart = chart.canvas && chart.canvas.id === 'insightsChart';
          const isBillingChart = chart.canvas && chart.canvas.id === 'billingTypeChart';
          const isHeatmapChart = chart.canvas && chart.canvas.id === 'heatmapChart';

          if (isTowerChart || isBillingChart || isHeatmapChart) {
            label = parseFloat(dataVal).toFixed(1) + '%';
          }

          let x = element.x;
          let y = element.y;
          try {
            if (element.tooltipPosition) {
              const pos = element.tooltipPosition();
              if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                x = pos.x;
                y = pos.y;
              }
            }
          } catch (e) {
            // fallback to element x,y
          }

          if (chart.config && chart.config.type === 'doughnut') {
            // Put the label in the center of the arc slice
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff'; // White text on doughnut slices
            ctx.font = 'bold 9px Outfit';
            ctx.fillText(label, x, y);
          } else if (chart.config && chart.config.options && chart.config.options.indexAxis === 'y') {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + 3, y);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, x, y - 2);
          }
        });
      }
    });
    ctx.restore();
  }
};

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
    },
    plugins: [valueLabelPlugin]
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
    },
    plugins: [valueLabelPlugin]
  });
}

// Chart 3: Asset Penetration by Client (Horizontal Bar, Top 10)
function renderHeatmapChart() {
  destroyChart('heatmap');
  const ctx = document.getElementById('heatmapChart');
  if (!ctx || state.assets.length === 0) return;

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
    },
    plugins: [valueLabelPlugin]
  });
}

// Chart 4: High Opportunity Targets — clients with most "Potential but lack CBA" FTE
function renderPotentialChart() {
  destroyChart('potential');
  const ctx = document.getElementById('potentialChart');
  if (!ctx) return;

  const clientPotential = {};
  state.rows.forEach(row => {
    const c = row.client;
    if (!clientPotential[c]) { clientPotential[c] = 0; }
    state.assets.forEach(asset => {
      const cell = state.cellData[`${row.id}::${asset}`];
      if (cell && cell.status === 'Potential but lack CBA') {
        clientPotential[c] += parseFloat(cell.fte || 0);
      }
    });
    if (row.decision === 'Potential but lack CBA') {
      clientPotential[c] += parseFloat(row.estimatedFteBenefit || 0);
    }
  });

  const sorted = Object.entries(clientPotential)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) {
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
    },
    plugins: [valueLabelPlugin]
  });
}

// Chart 5: AI Penetration by Billing Type (Polar Area Chart)
function renderBillingTypeChart() {
  destroyChart('billingType');
  const ctx = document.getElementById('billingTypeChart');
  if (!ctx) return;

  const stats = {};
  state.rows.forEach(row => {
    let bt = row.billingType || 'FTE';
    if (!stats[bt]) stats[bt] = { base: 0, pipe: 0 };
    stats[bt].base += parseFloat(row.baseFte || 0);
    stats[bt].pipe += parseFloat(row.pipelineFte || 0);
  });

  const labels = Object.keys(stats);
  const data = labels.map(l => stats[l].base > 0 ? parseFloat(((stats[l].pipe / stats[l].base) * 100).toFixed(1)) : 0);

  chartInstances['billingType'] = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(31,73,125,0.75)',
          'rgba(0,114,198,0.75)',
          'rgba(112,173,71,0.75)',
          'rgba(255,192,0,0.75)'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          ticks: { callback: v => v + '%', font: { size: 8 } }
        }
      },
      plugins: {
        legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 10 } }
      }
    },
    plugins: [valueLabelPlugin]
  });
}

// Chart 6: Est. FTE Benefit by Asset (Top 10 Vertical Bar)
function renderBenefitByAssetChart() {
  destroyChart('benefitByAsset');
  const ctx = document.getElementById('benefitByAssetChart');
  if (!ctx) return;

  const assetBenefits = {};
  state.assets.forEach(asset => {
    assetBenefits[asset] = 0;
  });

  Object.keys(state.cellData).forEach(key => {
    const parts = key.split('::');
    if (parts.length === 2) {
      const rowId = parts[0];
      const asset = parts[1];
      const cell = state.cellData[key];
      if (cell && cell.fte && cell.status !== 'Not Applicable') {
        const row = state.rows.find(r => r.id === rowId);
        if (row && row.assessment !== 'Not Started' && row.assessment !== 'No Scale') {
          assetBenefits[asset] = (assetBenefits[asset] || 0) + parseFloat(cell.fte || 0);
        }
      }
    }
  });

  const sorted = Object.entries(assetBenefits)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) {
    const c2 = ctx.getContext('2d');
    c2.fillStyle = '#aaa';
    c2.font = '12px Outfit';
    c2.textAlign = 'center';
    c2.fillText('No asset benefit data found.', ctx.width / 2, ctx.height / 2);
    return;
  }

  const labels = sorted.map(([name]) => name.length > 14 ? name.slice(0, 13) + '…' : name);
  const data = sorted.map(([, v]) => v);

  chartInstances['benefitByAsset'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Est. FTE Benefit',
        data,
        backgroundColor: 'rgba(0,114,198,0.85)',
        borderColor: '#005a9e',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { font: { size: 9 } } },
        y: { beginAtZero: true, ticks: { font: { size: 9 } } }
      },
      plugins: {
        legend: { display: false }
      }
    },
    plugins: [valueLabelPlugin]
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
  if (id === 'modal-client') populateClientModalList();
  if (id === 'modal-asset') populateAssetModalList();
  if (id === 'modal-owner') populateOwnerModalList();
  if (id === 'modal-tower') populateTowerModalList();
  if (id === 'modal-type') populateTypeModalList();
  if (id === 'modal-region') populateRegionModalList();
}

// --- Client Master ---
function populateClientModalList() {
  const c = document.getElementById('modalClientList');
  if (!state.clients) state.clients = [];
  c.innerHTML = state.clients.length
    ? state.clients.map(cl => `
      <div class="list-item">
        <span><strong>${escHtml(cl)}</strong></span>
        <button class="list-item-btn" onclick="handleDeleteClient('${escHtml(cl)}')">&times;</button>
      </div>`).join('')
    : '<div class="list-item" style="color:#aaa;">No clients defined.</div>';
}

function handleAddClient() {
  const input = document.getElementById('newClientNameName');
  const raw = input.value.trim();
  if (!raw) return;
  if (raw.length > 50) { alert('Client name too long (max 50 chars).'); return; }
  if (!state.clients) state.clients = [];
  if (state.clients.includes(raw)) { alert('Client already exists.'); return; }
  state.clients.push(raw);
  state.clients.sort((a, b) => a.localeCompare(b));
  input.value = '';
  populateClientModalList();
  updateFilterDropdowns();
  saveData();
}

function handleDeleteClient(clientName) {
  if (!confirm(`Delete client "${clientName}"? This will delete all rows mapped to this client and their asset cell allocations.`)) return;
  state.clients = state.clients.filter(c => c !== clientName);
  
  const toDelete = state.rows.filter(r => r.client === clientName).map(r => r.id);
  toDelete.forEach(rowId => {
    Object.keys(state.cellData).forEach(k => { if (k.startsWith(`${rowId}::`)) delete state.cellData[k]; });
  });
  
  state.rows = state.rows.filter(r => r.client !== clientName);
  
  populateClientModalList();
  updateFilterDropdowns();
  renderInputTable();
  if (activeTab === 'tab-assets') renderAssetGrid();
  saveData();
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
function normalizeKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

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
          // Normalize row keys
          const normRow = {};
          Object.keys(r).forEach(k => {
            normRow[normalizeKey(k)] = r[k];
          });

          const client = String(normRow['clientname'] || normRow['client'] || '').trim();
          const tower = String(normRow['tower'] || '').trim();
          const region = String(normRow['region'] || '').trim();
          const init = String(normRow['proposedasset'] || normRow['proposedinitiative'] || normRow['asset'] || '').trim();
          if (!client || !tower) return;

          // Auto-add client to master if not present
          if (!state.clients.includes(client)) {
            state.clients.push(client);
          }
          state.clients.sort((a, b) => a.localeCompare(b));

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
            if (normRow['region'] !== undefined) target.region = String(normRow['region']).trim();
            if (normRow['stack'] !== undefined) target.stack = String(normRow['stack']).trim();
            
            // Sequential parsing and validation
            let newBase = target.baseFte;
            let newAddr = target.addressableFte;
            let newPipe = target.pipelineFte;
            let newBen = target.estimatedFteBenefit;

            // 1. Parse Baseline FTE
            if (normRow['baselinefte'] !== undefined && normRow['baselinefte'] !== '') {
              const val = parseInt(normRow['baselinefte'], 10);
              if (!isNaN(val) && val >= 0) {
                newBase = val;
              }
            }

            // 2. Parse Addressable FTE
            if (normRow['addressablefte'] !== undefined && normRow['addressablefte'] !== '') {
              const val = parseFloat(normRow['addressablefte']);
              if (!isNaN(val) && val >= 0) {
                newAddr = val;
              }
            } else if (normRow['addressablefte'] === '') {
              newAddr = '';
            }

            // 3. Parse AI Potential FTE
            if (normRow['agenticpotentialfte'] !== undefined && normRow['agenticpotentialfte'] !== '') {
              const val = parseFloat(normRow['agenticpotentialfte']);
              if (!isNaN(val) && val >= 0) {
                newPipe = val;
              }
            } else if (normRow['aipotentialfte'] !== undefined && normRow['aipotentialfte'] !== '') {
              const val = parseFloat(normRow['aipotentialfte']);
              if (!isNaN(val) && val >= 0) {
                newPipe = val;
              }
            }

            // 4. Parse Estimated FTE Benefit
            if (normRow['estimatedftebenefit'] !== undefined && normRow['estimatedftebenefit'] !== '') {
              const val = parseFloat(normRow['estimatedftebenefit']);
              if (!isNaN(val) && val >= 0) {
                newBen = val;
              }
            } else if (normRow['estftebenefit'] !== undefined && normRow['estftebenefit'] !== '') {
              const val = parseFloat(normRow['estftebenefit']);
              if (!isNaN(val) && val >= 0) {
                newBen = val;
              }
            }

            // Validation checks
            let addrValid = true;
            let pipeValid = true;
            let benValid = true;
            let realizedValid = true;

            const baseVal = newBase === '' ? 0 : parseFloat(newBase);
            const addrVal = newAddr === '' ? baseVal : parseFloat(newAddr);

            if (newAddr !== '' && parseFloat(newAddr) > baseVal) {
              addrValid = false;
            }

            const targetAddr = addrValid ? addrVal : (target.addressableFte === '' ? baseVal : parseFloat(target.addressableFte));
            if (newPipe !== '' && parseFloat(newPipe) > targetAddr) {
              pipeValid = false;
            }

            const targetPipe = pipeValid ? (newPipe === '' ? 0 : parseFloat(newPipe)) : (target.pipelineFte === '' ? 0 : parseFloat(target.pipelineFte));
            if (newBen !== '' && parseFloat(newBen) > targetPipe) {
              benValid = false;
            }

            // Realized FTE parsing
            let newRealized = target.realizedFte;
            if (normRow['realizedfte'] !== undefined && normRow['realizedfte'] !== '') {
              const val = parseFloat(normRow['realizedfte']);
              if (!isNaN(val) && val >= 0) {
                newRealized = val;
              }
            } else if (normRow['realizedfte'] === '') {
              newRealized = '';
            }

            if (newRealized !== '' && parseFloat(newRealized) > targetPipe) {
              realizedValid = false;
            }

            target.baseFte = newBase;
            if (addrValid) target.addressableFte = newAddr;
            if (pipeValid) target.pipelineFte = newPipe;
            if (benValid) target.estimatedFteBenefit = newBen;
            if (realizedValid) target.realizedFte = newRealized;

            // Rest of fields
            if (normRow['assessmentstatus'] !== undefined && normRow['assessmentstatus'] !== '') {
              target.assessment = String(normRow['assessmentstatus']).trim();
            }
            if (normRow['clientdecision'] !== undefined && normRow['clientdecision'] !== '') {
              target.decision = String(normRow['clientdecision']).trim();
            } else if (normRow['clientapprovalforai'] !== undefined && normRow['clientapprovalforai'] !== '') {
              target.decision = String(normRow['clientapprovalforai']).trim();
            } else if (normRow['status'] !== undefined && normRow['status'] !== '') {
              target.decision = String(normRow['status']).trim();
            }
            
            if (normRow['proposedasset'] !== undefined && normRow['proposedasset'] !== '') {
              target.initiative = String(normRow['proposedasset']).trim();
            } else if (normRow['proposedinitiative'] !== undefined && normRow['proposedinitiative'] !== '') {
              target.initiative = String(normRow['proposedinitiative']).trim();
            }
            
            if (normRow['type'] !== undefined && normRow['type'] !== '') {
              target.initiativeType = String(normRow['type']).trim();
            }
            if (normRow['implementationcost'] !== undefined && normRow['implementationcost'] !== '') {
              target.implementationCost = parseFloat(normRow['implementationcost']) || 0;
            }
            if (normRow['dollarsavings'] !== undefined && normRow['dollarsavings'] !== '') {
              target.dollarSavings = parseFloat(normRow['dollarsavings']) || 0;
            } else if (normRow['savings'] !== undefined && normRow['savings'] !== '') {
              target.dollarSavings = parseFloat(normRow['savings']) || 0;
            }
            
            if (normRow['benchmark'] !== undefined && normRow['benchmark'] !== '') {
              let val = parseFloat(String(normRow['benchmark']).replace('%', ''));
              if (!isNaN(val)) {
                if (val > 0 && val <= 1) {
                  val = val * 100;
                }
                target.benchmark = val;
              }
            }
            if (normRow['owner'] !== undefined && normRow['owner'] !== '') {
              target.owner = String(normRow['owner']).trim() || 'None';
            }
            if (normRow['actionplan'] !== undefined) {
              target.actionPlan = String(normRow['actionplan']).trim();
            }
            if (normRow['clientactionplan'] !== undefined) {
              target.clientActionPlan = String(normRow['clientactionplan']).trim();
            }
          };

          if (existing) {
            applyFields(existing);
          } else {
            const uniq = new Set(state.rows.map(x => x.client.trim()));
            if (!uniq.has(client) && uniq.size >= 500) return;
            
            const newRow = {
              id: `row_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
              client, tower, region: region || '', baseFte: '', addressableFte: '', assessment: 'Not Started',
              pipelineFte: '', decision: '', initiative: '', initiativeType: '',
              estimatedFteBenefit: '', implementationCost: '', dollarSavings: '', benchmark: 20, owner: 'None', stack: '', actionPlan: '', clientActionPlan: ''
            };
            applyFields(newRow);
            
            const currentTowers = new Set(state.rows.filter(x => x.client.toLowerCase() === client.toLowerCase()).map(x => x.tower));
            currentTowers.add(tower);
            if (currentTowers.size <= 8) {
              state.rows.push(newRow);
              newRows++;
            }
          }

          if (init && !state.assets.includes(init) && state.assets.length < 100) { state.assets.push(init); newAssets++; }
          const type = String(normRow['type'] || '').trim();
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
      'Client Approval for AI', 'Proposed Asset', 'Type', 'Estimated FTE Benefit', 'Realized FTE', 'Implementation Cost ($)', '$ Savings', 'Owner', 'Benchmark %'];
    const masterHints = [
      'Unique client name (max 500)', 'Region name from master list (e.g. APAC, EMEA, Americas)', 'Tower name from master list (max 8 per client)',
      'Whole number ≥ 0', 'Not Started / In Progress / Completed / No Scale',
      'Fill if In Progress or Completed', 'Select / Deployed / Potential but lack CBA / In progress / Awaiting client approvals / Not Applicable',
      'Asset name (creates asset column if new)', 'From initiative type master (max 4 types)',
      'Fill if In Progress or Completed', 'Manually entered realized FTE (<= AI Potential FTE)', 'USD number', 'USD number (negative allowed)', 'Owner name', 'Number 0-100'
    ];
    const masterSamples = [
      ['Client Alpha', 'APAC', 'PTP', 150, 'Completed', 30, 'Deployed', 'Invoice Automation', 'Agentic', 28, 25, 75000, 120000, 'Jane Smith', 25],
      ['Client Alpha', 'APAC', 'RTR', 80, 'In Progress', 15, 'In progress', 'GL Reconciliation Bot', 'RPA', 12, 10, 40000, 60000, 'Jane Smith', 20],
      ['Client Beta', 'EMEA', 'OTC', 200, 'Not Started', 0, 'Select', '', '', 0, 0, 0, 0, 'None', 20],
      ['Client Beta', 'Americas', 'FP&A', 100, 'No Scale', 0, 'Not Applicable', '', '', 0, 0, 0, 0, 'None', 0],
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
      'Client Name', 'Region', 'Tower', 'Baseline FTE', 'Addressable FTE', 'Assessment Status', 'Agentic Potential FTE',
      'Client Approval for AI', 'Proposed Asset', 'Type', 'Stack', 'Est. FTE Benefit', 'Realized FTE',
      'Implementation Cost ($)', '$ Savings', 'Remaining Potential', 'Owner',
      'AI Potential %', 'Benefit %', 'Benchmark %', 'Variance %', 'Action Plan'
    ]];
    state.rows.forEach(row => {
      const baseVal = row.baseFte === '' ? 0 : parseFloat(row.baseFte || 0);
      const addrVal = getRowAddressableFte(row);
      const pipeVal = row.pipelineFte === '' ? 0 : parseFloat(row.pipelineFte || 0);
      const benVal = row.estimatedFteBenefit === '' ? 0 : parseFloat(row.estimatedFteBenefit || 0);

      const rem = pipeVal - benVal;
      const aiPotPct = addrVal > 0 ? (pipeVal / addrVal) * 100 : 0;
      const benPct = pipeVal > 0 ? (benVal / pipeVal) * 100 : 0;
      const variance = benPct - (row.benchmark || 0);

      masterData.push([
        row.client, row.region || '', row.tower, row.baseFte, row.addressableFte, row.assessment, row.pipelineFte,
        row.decision, row.initiative || '', row.initiativeType || '', row.stack || '', row.estimatedFteBenefit, row.realizedFte || '',
        row.implementationCost || 0, row.dollarSavings || 0, rem, row.owner || 'None',
        `${aiPotPct.toFixed(1)}%`, `${benPct.toFixed(1)}%`, `${row.benchmark}%`, `${variance.toFixed(1)}%`, row.actionPlan || ''
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

    // Sheet 3: Client_Summary
    const clientCols = [
      'Client Name', 'Client FTEs', 'Total Addressable FTE', 'Total AI Potential FTE',
      'Total Est. FTE Benefit', 'Total Remaining Potential', 'Owner', 'Action Plan'
    ];
    const clientData = [clientCols];

    const clientsMap = {};
    state.rows.forEach(row => {
      const client = (row.client || '').trim();
      if (!client) return;
      if (!clientsMap[client]) {
        clientsMap[client] = [];
      }
      clientsMap[client].push(row);
    });

    const sortedClients = Object.keys(clientsMap).sort((a, b) => a.localeCompare(b));
    sortedClients.forEach(client => {
      const rows = clientsMap[client];

      const towerMaxFte = {};
      rows.forEach(r => {
        const tower = (r.tower || '').trim();
        const baseFte = parseFloat(r.baseFte || 0);
        if (towerMaxFte[tower] === undefined || baseFte > towerMaxFte[tower]) {
          towerMaxFte[tower] = baseFte;
        }
      });
      const clientFtes = Object.values(towerMaxFte).reduce((sum, val) => sum + val, 0);

      let totalAddressable = 0;
      let totalAiPotential = 0;
      let totalEstBenefit = 0;
      let totalRemaining = 0;
      rows.forEach(r => {
        totalAddressable += getRowAddressableFte(r);
        totalAiPotential += parseFloat(r.pipelineFte || 0);
        totalEstBenefit += parseFloat(r.estimatedFteBenefit || 0);
        totalRemaining += parseFloat(r.pipelineFte || 0) - parseFloat(r.estimatedFteBenefit || 0);
      });

      const ownersSet = new Set(rows.map(r => r.owner || 'None'));
      const uniqueOwners = Array.from(ownersSet);
      let clientOwner = 'None';
      if (uniqueOwners.length === 1) {
        clientOwner = uniqueOwners[0];
      } else if (uniqueOwners.length > 1) {
        clientOwner = 'Multiple';
      }
      const clientActionPlan = rows[0]?.clientActionPlan || '';

      clientData.push([
        client, clientFtes, totalAddressable, totalAiPotential,
        totalEstBenefit, totalRemaining, clientOwner, clientActionPlan
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clientData), 'Client_Summary');

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

function renderClientSummary() {
  const summaryHeaders = document.querySelectorAll('#clientSummaryTable thead th');
  const summaryKeys = [
    'client-name', 'client-ftes', 'total-addressable', 'total-ai-potential',
    'total-est-benefit', 'total-remaining', 'owner', 'action-plan'
  ];
  summaryHeaders.forEach((th, idx) => {
    if (summaryKeys[idx]) {
      makeColumnResizable(th, 'summary-' + summaryKeys[idx]);
    }
  });

  const tbody = document.getElementById('clientSummaryBody');
  const tfoot = document.getElementById('clientSummaryTotals');
  if (!tbody || !tfoot) return;

  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  // Group rows by client
  const clientsMap = {};
  state.rows.forEach(row => {
    const client = (row.client || '').trim();
    if (!client) return;
    if (!clientsMap[client]) {
      clientsMap[client] = [];
    }
    clientsMap[client].push(row);
  });

  const sortedClients = Object.keys(clientsMap).sort((a, b) => a.localeCompare(b));

  let grandClientFte = 0;
  let grandAddressable = 0;
  let grandAiPotential = 0;
  let grandEstBenefit = 0;
  let grandRemaining = 0;

  sortedClients.forEach(client => {
    const rows = clientsMap[client];

    // Client FTEs calculation: sum over unique towers of max(Base FTE)
    const towerMaxFte = {};
    rows.forEach(r => {
      const tower = (r.tower || '').trim();
      const baseFte = parseFloat(r.baseFte || 0);
      if (towerMaxFte[tower] === undefined || baseFte > towerMaxFte[tower]) {
        towerMaxFte[tower] = baseFte;
      }
    });
    const clientFtes = Object.values(towerMaxFte).reduce((sum, val) => sum + val, 0);

    // Sum other values
    let totalAddressable = 0;
    let totalAiPotential = 0;
    let totalEstBenefit = 0;
    let totalRemaining = 0;

    rows.forEach(r => {
      totalAddressable += getRowAddressableFte(r);
      totalAiPotential += parseFloat(r.pipelineFte || 0);
      totalEstBenefit += parseFloat(r.estimatedFteBenefit || 0);
      totalRemaining += parseFloat(r.pipelineFte || 0) - parseFloat(r.estimatedFteBenefit || 0);
    });

    grandClientFte += clientFtes;
    grandAddressable += totalAddressable;
    grandAiPotential += totalAiPotential;
    grandEstBenefit += totalEstBenefit;
    grandRemaining += totalRemaining;

    // Determine client owner
    const ownersSet = new Set(rows.map(r => r.owner || 'None'));
    const uniqueOwners = Array.from(ownersSet);
    let clientOwner = 'None';
    if (uniqueOwners.length === 1) {
      clientOwner = uniqueOwners[0];
    } else if (uniqueOwners.length > 1) {
      clientOwner = 'Multiple';
    }

    const clientActionPlan = rows[0]?.clientActionPlan || '';

    // Render Owner cell
    let ownerCellContent = '';
    if (editingClientOwner === client) {
      let ownerOpts = `<option value="None" ${clientOwner === 'None' ? 'selected' : ''}>None</option>`;
      if (clientOwner === 'Multiple') {
        ownerOpts += `<option value="Multiple" disabled selected>-- Multiple --</option>`;
      }
      Object.keys(state.owners).forEach(n => {
        ownerOpts += `<option value="${escHtml(n)}" ${clientOwner === n ? 'selected' : ''}>${escHtml(n)}</option>`;
      });
      ownerCellContent = `
        <select onchange="handleClientOwnerChange('${escHtml(client)}', this.value)" style="width: 100px;">
          ${ownerOpts}
        </select>
        <button class="owner-edit-btn" onclick="cancelClientOwnerEdit()" title="Cancel">✕</button>
      `;
    } else {
      let emailAnchor = '';
      if (clientOwner !== 'None' && clientOwner !== 'Multiple') {
        const ownerEmail = state.owners[clientOwner] || '';
        if (ownerEmail) {
          const subj = encodeURIComponent(`AI Penetration Summary Update - ${client}`);
          const body = encodeURIComponent(`Hi ${clientOwner},\n\nHere is the current AI Penetration summary for ${client}:\n\n- Client FTEs: ${clientFtes}\n- Total Addressable FTE: ${totalAddressable}\n- AI Potential FTE: ${totalAiPotential}\n- Est. FTE Benefit: ${totalEstBenefit}\n- Total Remaining Potential: ${totalRemaining}\n\nPlease review and let us know if there are any updates.\n\nRegards`);
          emailAnchor = `<a href="mailto:${ownerEmail}?subject=${subj}&body=${body}" class="owner-email-icon-btn" title="Email ${clientOwner}">✉</a>`;
        }
      }
      ownerCellContent = `
        <span class="owner-name-text" style="font-size:9.5px;max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(clientOwner === 'Multiple' ? '-- Multiple --' : clientOwner)}</span>
        ${emailAnchor}
        <button class="owner-edit-btn" onclick="startClientOwnerEdit('${escHtml(client)}')" title="Edit Owner">✎</button>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(client)}</strong></td>
      <td class="col-num">${clientFtes}</td>
      <td class="col-num">${totalAddressable}</td>
      <td class="col-num">${totalAiPotential}</td>
      <td class="col-num">${totalEstBenefit}</td>
      <td class="col-num">${totalRemaining}</td>
      <td>
        <div class="owner-cell-container" style="display:flex;align-items:center;gap:4px;">
          ${ownerCellContent}
        </div>
      </td>
      <td>
        <input type="text" value="${escHtml(clientActionPlan)}" style="width: 100%; box-sizing: border-box;"
          onchange="handleClientActionPlanChange('${escHtml(client)}', this)" placeholder="Action plan">
      </td>
    `;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `
    <td>TOTAL</td>
    <td class="col-num">${grandClientFte}</td>
    <td class="col-num">${grandAddressable}</td>
    <td class="col-num">${grandAiPotential}</td>
    <td class="col-num">${grandEstBenefit}</td>
    <td class="col-num">${grandRemaining}</td>
    <td colspan="2"></td>
  `;
}

// ==========================================
// TECHNICAL REFERENCE & FUNCTIONS REGISTRY
// ==========================================
const FUNCTIONS_REGISTRY = [
  { name: 'setupNavigation', line: 100, category: 'State Management & API Sync', desc: 'Sets up click listeners for the navigation tabs to toggle visibility and trigger view rendering.' },
  { name: 'getApiUrl', line: 121, category: 'State Management & API Sync', desc: 'Utility to resolve host-relative REST API endpoints (handling file:// protocol local fallbacks).' },
  { name: 'loadBackupsList', line: 128, category: 'State Management & API Sync', desc: 'Fetches list of available system backups from /api/backups and updates header load select dropdown.' },
  { name: 'handleRestoreBackup', line: 147, category: 'State Management & API Sync', desc: 'Sends selected backup filename to /api/restore to overwrite current data state and reload client.' },
  { name: 'handleResetState', line: 194, category: 'State Management & API Sync', desc: 'Erases all local configuration and data rows on server/client after user confirmation.' },
  { name: 'loadData', line: 221, category: 'State Management & API Sync', desc: 'Fetches active state from /api/data and sets defaults for compatibility.' },
  { name: 'saveData', line: 273, category: 'State Management & API Sync', desc: 'Sends current client data model as JSON to /api/data, creating timestamped server backup.' },
  { name: 'pollServer', line: 300, category: 'State Management & API Sync', desc: 'Periodically polls the backups list from the server to refresh selection options.' },
  { name: 'showStatus', line: 327, category: 'Helpers & Utilities', desc: 'Displays a brief visual status/toast message in the bottom-right corner.' },
  { name: 'escHtml', line: 337, category: 'Helpers & Utilities', desc: 'Escapes HTML characters to prevent cross-site scripting (XSS).' },
  { name: 'isAssessmentActive', line: 341, category: 'Helpers & Utilities', desc: 'Returns true if row assessment status is In Progress or Completed.' },
  { name: 'getTowerBenchmark', line: 345, category: 'Helpers & Utilities', desc: 'Resolves process-specific baseline benchmarks (RTR: 40%, PTP/OTC: 60%, others: 20%).' },
  { name: 'getDecisionColorClass', line: 354, category: 'Helpers & Utilities', desc: 'Resolves visual CSS color classes for Client Approval selections.' },
  { name: 'getAssessmentColorClass', line: 363, category: 'Helpers & Utilities', desc: 'Resolves CSS classes mapping assessment status states to colors.' },
  { name: 'getPctColorClass', line: 369, category: 'Helpers & Utilities', desc: 'Formats color classes (red/green) for percentage-based variances.' },
  { name: 'getCellStatusClass', line: 378, category: 'Helpers & Utilities', desc: 'Resolves CSS classes for allocation matrix cells based on deployment status.' },
  { name: 'getUniqueClientCount', line: 386, category: 'Helpers & Utilities', desc: 'Calculates the total number of unique client names configured in the system.' },
  { name: 'getTowerCountForClient', line: 395, category: 'Helpers & Utilities', desc: 'Counts unique towers for a given client to enforce maximum client tower limits.' },
  { name: 'savePrev', line: 404, category: 'Helpers & Utilities', desc: 'Stores current inputs in memory to support input restoration on validation failure.' },
  { name: 'isDuplicateRow', line: 406, category: 'Helpers & Utilities', desc: 'Checks if Client + Tower + Region + Proposed Asset combination already exists.' },
  { name: 'getFormattedDateTime', line: 410, category: 'Helpers & Utilities', desc: 'Generates formatted timestamp for file exports.' },
  { name: 'downloadJsonState', line: 425, category: 'Helpers & Utilities', desc: 'Triggers local download of system JSON file.' },
  { name: 'handleRegionChange', line: 437, category: 'Filter & Sort Logic', desc: 'Updates a row\'s Region and applies filters.' },
  { name: 'updateFilterDropdowns', line: 449, category: 'Filter & Sort Logic', desc: 'Populates filter dropdown options dynamically based on matching dataset rows.' },
  { name: 'getActiveFilters', line: 528, category: 'Filter & Sort Logic', desc: 'Returns active keys from current filter state selections.' },
  { name: 'applyFilters', line: 541, category: 'Filter & Sort Logic', desc: 'Re-renders all dashboard tables and graphs based on user selection filters.' },
  { name: 'clearFilters', line: 567, category: 'Filter & Sort Logic', desc: 'Resets all filter dropdown selectors to empty state.' },
  { name: 'getFilteredRows', line: 590, category: 'Filter & Sort Logic', desc: 'Returns a filtered subset of rows matching all active filter selections.' },
  { name: 'handleSort', line: 724, category: 'Filter & Sort Logic', desc: 'Sets/toggles sorting direction (ascending, descending, or none) for a column header.' },
  { name: 'getSortedRows', line: 735, category: 'Filter & Sort Logic', desc: 'Applies sorting order to the filtered set of data rows.' },
  { name: 'makeColumnResizable', line: 615, category: 'Addressable FTE & Validation Rules', desc: 'Attaches mouse dragging handlers to table headers to support manual column resizing.' },
  { name: 'getRowAddressableFte', line: 658, category: 'Addressable FTE & Validation Rules', desc: 'Returns row addressable FTE, evaluating empty/blank inputs as 0.' },
  { name: 'getClientTowerAddressable', line: 665, category: 'Addressable FTE & Validation Rules', desc: 'Sums addressable FTEs across all rows of a given Client + Tower combination.' },
  { name: 'getMaxBaseFteForClientTower', line: 674, category: 'Addressable FTE & Validation Rules', desc: 'Finds the maximum Base FTE declared for a Client + Tower combination.' },
  { name: 'validateClientTowerFteConstraint', line: 686, category: 'Addressable FTE & Validation Rules', desc: 'Checks that total addressable FTEs do not exceed maximum baseline FTEs for a client-tower.' },
  { name: 'renderInputTableHeader', line: 769, category: 'Input Table Rendering & Headers', desc: 'Compiles and renders the table header row on the Input Dashboard, binding resizing handles.' },
  { name: 'renderInputTable', line: 811, category: 'Input Table Rendering & Headers', desc: 'Compiles and renders the main data table, editing inputs, validation highlights, and footers.' },
  { name: 'handleRowInputChange', line: 1079, category: 'Input Table Rendering & Headers', desc: 'Receives keyup events from inputs and forwards to validation handlers.' },
  { name: 'validateRowUpdate', line: 1094, category: 'Input Table Rendering & Headers', desc: 'Checks inputs validations before saving rows to server.' },
  { name: 'handleClientChange', line: 1124, category: 'Change Handlers (Inline Inputs)', desc: 'Validates and saves client name changes, checking maximum tower bounds.' },
  { name: 'handleTowerChange', line: 1143, category: 'Change Handlers (Inline Inputs)', desc: 'Validates and saves tower changes, verifying maximum tower rules.' },
  { name: 'handleBaseFteChange', line: 1163, category: 'Change Handlers (Inline Inputs)', desc: 'Processes Base FTE edits, enforcing Base >= Addressable and Base >= AI Potential.' },
  { name: 'handleAddressableFteChange', line: 1203, category: 'Change Handlers (Inline Inputs)', desc: 'Validates Addressable FTE edits, enforcing Addressable <= Base and Addressable >= AI Potential.' },
  { name: 'handlePipelineFteChange', line: 1245, category: 'Change Handlers (Inline Inputs)', desc: 'Validates AI Potential FTE edits, enforcing AI Potential <= Addressable, Realized, and Benefit.' },
  { name: 'handleRealizedFteChange', line: 1281, category: 'Change Handlers (Inline Inputs)', desc: 'Enforces Realized FTE <= AI Potential FTE and updates state.' },
  { name: 'handleFteBenefitChange', line: 1310, category: 'Change Handlers (Inline Inputs)', desc: 'Enforces Est. FTE Benefit <= AI Potential FTE, updates Benefit %, and syncs cell mapping.' },
  { name: 'handleAssessmentChange', line: 1351, category: 'Change Handlers (Inline Inputs)', desc: 'Updates assessment status, disabling asset selections if Not Started/No Scale.' },
  { name: 'updateRowField', line: 1358, category: 'Change Handlers (Inline Inputs)', desc: 'Generic helper to update a row field and submit changes.' },
  { name: 'handleSavingsChange', line: 1365, category: 'Change Handlers (Inline Inputs)', desc: 'Updates row implementation cost and calculated savings.' },
  { name: 'handleDecisionDropdownChange', line: 1381, category: 'Change Handlers (Inline Inputs)', desc: 'Updates client decision dropdown and changes corresponding color class styling.' },
  { name: 'handleProposedAssetChange', line: 1401, category: 'Change Handlers (Inline Inputs)', desc: 'Updates the proposed asset field from dropdown selection.' },
  { name: 'startOwnerEdit', line: 1445, category: 'Owner & Action Plan Editors', desc: 'Enables owner select dropdown inline on the Input page.' },
  { name: 'cancelOwnerEdit', line: 1450, category: 'Owner & Action Plan Editors', desc: 'Cancels owner selection edit mode.' },
  { name: 'handleOwnerDropdownChange', line: 1455, category: 'Owner & Action Plan Editors', desc: 'Saves owner changes and refreshes table.' },
  { name: 'startClientOwnerEdit', line: 1465, category: 'Owner & Action Plan Editors', desc: 'Enables client owner select dropdown inline on the Client FTE Summary page.' },
  { name: 'cancelClientOwnerEdit', line: 1470, category: 'Owner & Action Plan Editors', desc: 'Cancels client owner selection edit mode.' },
  { name: 'handleClientOwnerChange', line: 1475, category: 'Owner & Action Plan Editors', desc: 'Applies owner changes across all rows of the client and updates database.' },
  { name: 'handleRowActionPlanChange', line: 1484, category: 'Owner & Action Plan Editors', desc: 'Enforces 35-word limit and saves input page row Action Plan.' },
  { name: 'handleClientActionPlanChange', line: 1498, category: 'Owner & Action Plan Editors', desc: 'Enforces 35-word limit and syncs Action Plan across all client rows.' },
  { name: 'showInitiativeSuggestions', line: 1514, category: 'Autocomplete & Suggestions', desc: 'Displays autocomplete dropdown suggestion box for assets.' },
  { name: 'filterInitiativeSuggestions', line: 1516, category: 'Autocomplete & Suggestions', desc: 'Filters suggestion options based on input text.' },
  { name: 'selectInitiative', line: 1528, category: 'Autocomplete & Suggestions', desc: 'Populates suggested asset into cell input and closes suggestions.' },
  { name: 'handleInitiativeInputChange', line: 1536, category: 'Autocomplete & Suggestions', desc: 'Processes keypresses inside autocomplete asset textbox.' },
  { name: 'handleAddRow', line: 1592, category: 'Row Operations', desc: 'Appends a blank row to the data state and triggers save.' },
  { name: 'handleDeleteRow', line: 1619, category: 'Row Operations', desc: 'Removes a row from the data state after user confirmation.' },
  { name: 'renderAssetGrid', line: 1628, category: 'Asset Grid Matrix Popover', desc: 'Compiles and renders the N×M matrix mapping operational rows to assets.' },
  { name: 'toggleHeaderRotation', line: 1718, category: 'Asset Grid Matrix Popover', desc: 'Toggles rotated header styles and shrinks matrix column widths.' },
  { name: 'openCellPopover', line: 1725, category: 'Asset Grid Matrix Popover', desc: 'Displays allocation popover at cell coordinates for editing cell FTE/Status.' },
  { name: 'selectPopoverStatus', line: 1741, category: 'Asset Grid Matrix Popover', desc: 'Sets selected status value inside popover.' },
  { name: 'updatePopoverBadgeSelection', line: 1743, category: 'Asset Grid Matrix Popover', desc: 'Updates styling class of active popover status badges.' },
  { name: 'closePopover', line: 1749, category: 'Asset Grid Matrix Popover', desc: 'Hides cell edit popover.' },
  { name: 'handleSavePopover', line: 1754, category: 'Asset Grid Matrix Popover', desc: 'Validates cell FTE, updates cell allocation data, and saves state.' },
  { name: 'destroyChart', line: 1785, category: 'Executive Insights & Charts', desc: 'Safely destroys past Chart.js instance to prevent canvas rendering conflicts.' },
  { name: 'calcAssetPenetration', line: 1790, category: 'Executive Insights & Charts', desc: 'Calculates active AI asset penetration ratios across client towers.' },
  { name: 'penColorClass', line: 1833, category: 'Executive Insights & Charts', desc: 'Resolves CSS styles for penetration percentages.' },
  { name: 'renderPenetrationBand', line: 1840, category: 'Executive Insights & Charts', desc: 'Renders executive top-level banner summary color gradients.' },
  { name: 'renderInsights', line: 1867, category: 'Executive Insights & Charts', desc: 'Compiles data summaries and renders all Chart.js instances and observations.' },
  { name: 'renderTowerChart', line: 1975, category: 'Executive Insights & Charts', desc: 'Creates Bar chart representing Tower Pipeline vs Benchmark.' },
  { name: 'renderApprovalChart', line: 2001, category: 'Executive Insights & Charts', desc: 'Creates Doughnut chart for Client Approval status distribution.' },
  { name: 'renderHeatmapChart', line: 2047, category: 'Executive Insights & Charts', desc: 'Creates horizontal Bar chart of top client penetration ranks.' },
  { name: 'renderPotentialChart', line: 2093, category: 'Executive Insights & Charts', desc: 'Creates Bar chart showing high opportunity targets awaiting approval.' },
  { name: 'renderBillingTypeChart', line: 2156, category: 'Executive Insights & Charts', desc: 'Creates Radar chart comparing penetration by billing types.' },
  { name: 'renderBenefitByAssetChart', line: 2203, category: 'Executive Insights & Charts', desc: 'Creates vertical Bar chart displaying FTE benefits by asset.' },
  { name: 'renderInsightsList', line: 2273, category: 'Executive Insights & Charts', desc: 'Generates standard portfolio and custom-added user observations.' },
  { name: 'editAutoInsight', line: 2367, category: 'Executive Insights & Charts', desc: 'Opens editing input for automated summary observations.' },
  { name: 'cancelAutoInsightEdit', line: 2371, category: 'Executive Insights & Charts', desc: 'Discards edits to automated observations.' },
  { name: 'saveAutoInsightEdit', line: 2375, category: 'Executive Insights & Charts', desc: 'Saves override text for automated insights.' },
  { name: 'addCustomInsight', line: 2387, category: 'Executive Insights & Charts', desc: 'Opens input form to add custom portfolio observation.' },
  { name: 'cancelAddInsight', line: 2393, category: 'Executive Insights & Charts', desc: 'Discards inputs and closes new observation form.' },
  { name: 'saveNewInsight', line: 2399, category: 'Executive Insights & Charts', desc: 'Saves new custom observation to system state.' },
  { name: 'deleteCustomInsight', line: 2410, category: 'Executive Insights & Charts', desc: 'Removes a custom observation from list.' },
  { name: 'editCustomInsight', line: 2416, category: 'Executive Insights & Charts', desc: 'Opens edit box for custom observation.' },
  { name: 'cancelCustomInsightEdit', line: 2420, category: 'Executive Insights & Charts', desc: 'Discards custom observation edits.' },
  { name: 'saveCustomInsightEdit', line: 2424, category: 'Executive Insights & Charts', desc: 'Saves custom observation edits to state.' },
  { name: 'openModal', line: 2437, category: 'Modal Editors', desc: 'Displays specified modal container and populates lists.' },
  { name: 'populateClientModalList', line: 2448, category: 'Modal Editors', desc: 'Populates client list inside Client Master list modal.' },
  { name: 'handleAddClient', line: 2460, category: 'Modal Editors', desc: 'Appends new client name to client master list.' },
  { name: 'handleDeleteClient', line: 2475, category: 'Modal Editors', desc: 'Deletes client name from master, deleting matching rows.' },
  { name: 'closeModal', line: 2492, category: 'Modal Editors', desc: 'Hides open modal dialog.' },
  { name: 'populateRegionModalList', line: 2495, category: 'Modal Editors', desc: 'Populates list in Region Master modal.' },
  { name: 'handleAddRegion', line: 2506, category: 'Modal Editors', desc: 'Appends region name to master.' },
  { name: 'handleDeleteRegion', line: 2519, category: 'Modal Editors', desc: 'Deletes region from master.' },
  { name: 'populateTowerModalList', line: 2532, category: 'Modal Editors', desc: 'Populates list in Tower Master modal.' },
  { name: 'handleAddTower', line: 2543, category: 'Modal Editors', desc: 'Appends tower name to master.' },
  { name: 'handleDeleteTower', line: 2561, category: 'Modal Editors', desc: 'Deletes tower from master, removing matching data.' },
  { name: 'populateTypeModalList', line: 2584, category: 'Modal Editors', desc: 'Populates list in Initiative Type Master modal.' },
  { name: 'handleAddType', line: 2596, category: 'Modal Editors', desc: 'Appends initiative type label to master.' },
  { name: 'handleDeleteType', line: 2608, category: 'Modal Editors', desc: 'Deletes type label from master.' },
  { name: 'populateAssetModalList', line: 2617, category: 'Modal Editors', desc: 'Populates columns list in Asset Columns modal.' },
  { name: 'handleAddAsset', line: 2628, category: 'Modal Editors', desc: 'Appends new asset column name to master.' },
  { name: 'handleDeleteAsset', line: 2641, category: 'Modal Editors', desc: 'Deletes asset column from master and cell data mapping.' },
  { name: 'populateOwnerModalList', line: 2651, category: 'Modal Editors', desc: 'Populates directory list in Owner Directory modal.' },
  { name: 'handleAddOwner', line: 2663, category: 'Modal Editors', desc: 'Appends new owner name and email to master.' },
  { name: 'handleDeleteOwner', line: 2675, category: 'Modal Editors', desc: 'Deletes owner from master directory.' },
  { name: 'normalizeKey', line: 2686, category: 'File Import & Export', desc: 'Normalizes spreadsheet header text to lowercase trimmed keys.' },
  { name: 'handleBulkUpload', line: 2690, category: 'File Import & Export', desc: 'Reads and parses Excel/CSV files, running integrity checks and merging records.' },
  { name: 'downloadBulkTemplate', line: 2966, category: 'File Import & Export', desc: 'Generates and downloads a pre-formatted Excel template for bulk upload.' },
  { name: 'downloadXls', line: 3053, category: 'File Import & Export', desc: 'Generates styled workbook containing Master_Tracker, Asset_Mapping, and Client_Summary worksheets.' },
  { name: 'downloadPpt', line: 3169, category: 'File Import & Export', desc: 'Creates and downloads executive presentation summarizing portfolio findings.' },
  { name: 'renderClientSummary', line: 3203, category: 'Client Summary Tab Rendering', desc: 'Compiles and renders Client FTE Summary table with dynamic grouping and resizer handles.' },
  { name: 'renderLeaderboard', line: 3480, category: 'AI Leaderboard Rendering', desc: 'Renders the Executive AI Leaderboard ranking clients dynamically as a clean horizontal bar chart with business icons.' }
];

window.renderLeaderboard = function() {
  const container = document.getElementById('leadListSimplified');
  if (!container) return;

  container.innerHTML = '';

  // 1. Group rows by client name
  const clientsMap = {};
  state.rows.forEach(row => {
    const client = (row.client || '').trim();
    if (!client) return;
    if (!clientsMap[client]) {
      clientsMap[client] = {
        name: client,
        addressableFte: 0,
        pipelineFte: 0,
        estimatedFteBenefit: 0,
        realizedFte: 0,
        rawTowers: []
      };
    }
    const cObj = clientsMap[client];
    cObj.addressableFte += getRowAddressableFte(row);
    cObj.pipelineFte += parseFloat(row.pipelineFte || 0);
    cObj.estimatedFteBenefit += parseFloat(row.estimatedFteBenefit || 0);
    cObj.realizedFte += parseFloat(row.realizedFte || 0);
    cObj.rawTowers.push(row);
  });

  const clientsList = Object.values(clientsMap);

  if (clientsList.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #999; padding: 30px; font-size: 11px;">🏢 No client data available. Please add clients and baseline FTEs on the Input dashboard.</div>`;
    return;
  }

  // Calculate percentages
  clientsList.forEach(cObj => {
    const towerMaxFte = {};
    cObj.rawTowers.forEach(r => {
      const tower = (r.tower || '').trim();
      const baseFte = parseFloat(r.baseFte || 0);
      if (towerMaxFte[tower] === undefined || baseFte > towerMaxFte[tower]) {
        towerMaxFte[tower] = baseFte;
      }
    });
    cObj.clientFtes = Object.values(towerMaxFte).reduce((sum, val) => sum + val, 0);

    cObj.potentialPct = cObj.addressableFte > 0 ? (cObj.pipelineFte / cObj.addressableFte) * 100 : 0;
    cObj.realizationRate = cObj.estimatedFteBenefit > 0 ? (cObj.realizedFte / cObj.estimatedFteBenefit) * 100 : 0;
  });

  // 2. Sort clients by Mapped AI Potential % in descending order
  clientsList.sort((a, b) => b.potentialPct - a.potentialPct);

  // Helper to get rank badge or medal icon
  function getRankBadgeHTML(idx) {
    const rank = idx + 1;
    if (rank === 1) return `<span style="font-size: 16px;" title="Gold Medal">🥇</span>`;
    if (rank === 2) return `<span style="font-size: 16px;" title="Silver Medal">🥈</span>`;
    if (rank === 3) return `<span style="font-size: 16px;" title="Bronze Medal">🥉</span>`;
    return `<div class="rank-badge rank-default">${rank}</div>`;
  }

  // Find max value to compute fill width percentage relative to leader
  const maxPotentialVal = Math.max(1, clientsList[0].potentialPct);

  // 3. Render client rows
  clientsList.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'leaderboard-row';
    
    const fillWidth = Math.min(100, Math.max(2, (c.potentialPct / maxPotentialVal) * 100));
    
    div.innerHTML = `
      ${getRankBadgeHTML(idx)}
      <div class="lead-client-name" title="${escHtml(c.name)}">${escHtml(c.name)}</div>
      <div class="lead-progress-wrapper">
        <div class="lead-progress-bar-container" title="Mapped Potential: ${c.potentialPct.toFixed(1)}%">
          <div class="lead-progress-bar" style="width: ${fillWidth}%;"></div>
        </div>
      </div>
      <div class="lead-value">${c.potentialPct.toFixed(1)}%</div>
      
      <!-- Inline Metrics with Business Icons -->
      <div class="lead-metrics-inline">
        <div class="lead-metric-item" title="Baseline headcount">
          <span>👥</span>
          <strong>${c.clientFtes} FTE</strong>
        </div>
        <div class="lead-metric-item" title="Estimated FTE benefits mapped">
          <span>💡</span>
          <strong>${c.estimatedFteBenefit.toFixed(1)} FTE</strong>
        </div>
        <div class="lead-metric-item" title="Realized benefits live in production">
          <span>⚡</span>
          <strong style="color: var(--status-deployed);">${c.realizedFte.toFixed(1)} FTE</strong>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
};

