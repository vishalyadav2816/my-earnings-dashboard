/**
 * EarnFlow — app.js
 * Handles: Charts, CRUD for earnings, search, filters, CSV export
 * All functions used by dashboard.html
 */

/* ─── Chart.js setup ─── */
Chart.defaults.color          = '#94a3b8';
Chart.defaults.font.family    = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.borderColor    = 'rgba(42,51,71,0.6)';

let monthlyChartInst  = null;
let platformChartInst = null;

document.addEventListener('DOMContentLoaded', () => {
  // Default date to today for earning modal
  const ed = document.getElementById('e-date');
  if (ed) ed.value = new Date().toISOString().split('T')[0];
  loadCharts();
});

/* ── MODAL HELPERS ── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function backdropClose(e, id) { if (e.target.id === id) closeModal(id); }

/* ── CHARTS ── */
async function loadCharts() {
  try {
    const r = await fetch('/api/analytics');
    const d = await r.json();
    if (!d.success) return;
    drawMonthly(d.monthly);
    drawPlatform(d.platforms);
  } catch (err) { console.warn('Charts failed:', err); }
}

function drawMonthly(data) {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  if (monthlyChartInst) monthlyChartInst.destroy();

  monthlyChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Project Revenue',
          data: data.project,
          backgroundColor: 'rgba(99,102,241,0.85)',
          hoverBackgroundColor: '#818cf8',
          borderRadius: 6, borderSkipped: false,
          barPercentage: 0.6, categoryPercentage: 0.7
        },
        {
          label: 'Freelance Revenue',
          data: data.freelance,
          backgroundColor: 'rgba(6,182,212,0.85)',
          hoverBackgroundColor: '#38bdf8',
          borderRadius: 6, borderSkipped: false,
          barPercentage: 0.6, categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12, weight: '700' } }
        },
        tooltip: {
          backgroundColor: '#1e2436', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
          borderColor: '#2a3347', borderWidth: 1, padding: 12, boxPadding: 6,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } },
        y: {
          grid: { color: 'rgba(42,51,71,0.6)' },
          ticks: { callback: v => '$' + v.toLocaleString(), font: { family: "'JetBrains Mono', monospace", size: 11 } }
        }
      }
    }
  });
}

function drawPlatform(data) {
  const ctx = document.getElementById('platformChart');
  if (!ctx) return;
  if (platformChartInst) platformChartInst.destroy();

  const palette = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899','#8b5cf6'];

  platformChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: palette.slice(0, data.labels.length),
        borderColor: '#161b27',
        borderWidth: 3,
        hoverOffset: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11, weight: '600' } }
        },
        tooltip: {
          backgroundColor: '#1e2436', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
          borderColor: '#2a3347', borderWidth: 1, padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.label}: $${ctx.parsed.toLocaleString()}`
          }
        }
      }
    }
  });
}

/* ── ADD EARNING ── */
async function submitEarning(e) {
  e.preventDefault();
  const btn = document.getElementById('earn-submit-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  const data = Object.fromEntries(new FormData(document.getElementById('earn-form')).entries());
  try {
    const res = await fetch('/api/earnings/add', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await res.json();
    if (j.success) {
      showToast('Earning saved!', 'success');
      closeModal('earn-modal');
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(j.message || 'Error saving earning', 'danger');
    }
  } catch { showToast('Network error. Try again.', 'danger'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Earning'; }
}

/* ── TOGGLE STATUS ── */
async function toggleStatus(id, current) {
  const next = current === 'paid' ? 'pending' : 'paid';
  try {
    const res = await fetch(`/api/earnings/${id}/status`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: next })
    });
    const j = await res.json();
    if (j.success) {
      showToast(`Marked as ${next.toUpperCase()}`, 'info');
      location.reload();
    } else {
      showToast('Failed to update status', 'danger');
    }
  } catch { showToast('Network error', 'danger'); }
}

/* ── DELETE EARNING ── */
async function deleteEarning(id) {
  if (!confirm('Delete this earning record?')) return;
  try {
    const res = await fetch(`/api/earnings/${id}/delete`, { method: 'POST' });
    const j = await res.json();
    if (j.success) {
      showToast('Record deleted', 'success');
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.remove();
      updateCount();
    } else {
      showToast(j.message || 'Error deleting record', 'danger');
    }
  } catch { showToast('Network error', 'danger'); }
}

/* ── FILTER ROWS ── */
function filterRows(type, btn) {
  document.querySelectorAll('.fpill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#earn-body tr[data-id]').forEach(row => {
    const match = type === 'all'
      || row.dataset.type   === type
      || row.dataset.status === type;
    row.style.display = match ? '' : 'none';
  });
  updateCount();
}

/* ── SEARCH ROWS ── */
function searchRows(q) {
  const lq = q.trim().toLowerCase();
  document.querySelectorAll('#earn-body tr[data-id]').forEach(row => {
    row.style.display = (!lq || row.dataset.search.toLowerCase().includes(lq)) ? '' : 'none';
  });
  updateCount();
}

function updateCount() {
  const vis = document.querySelectorAll('#earn-body tr[data-id]:not([style*="display: none"])').length;
  const el = document.getElementById('earn-count');
  if (el) el.textContent = vis;
}

/* ── CSV EXPORT ── */
function exportCSV() {
  const rows = document.querySelectorAll('#earn-body tr[data-id]');
  if (!rows.length) { showToast('No records to export', 'warning'); return; }

  const headers = ['Title','Client','Type','Platform','Date','Amount','Status','Notes'];
  const lines = [headers.join(',')];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    // Extract values from rendered cells
    const title    = `"${(row.querySelector('.cell-title')?.textContent || '').trim()}"`;
    const note     = `"${(row.querySelector('.cell-note')?.textContent  || '').trim().replace(/\n/g,' ')}"`;
    const client   = `"${(row.querySelector('.cell-client')?.textContent || '').trim()}"`;
    const type     = `"${row.dataset.type}"`;
    const platform = `"${(row.querySelector('.cell-platform')?.textContent || '').trim()}"`;
    const date     = `"${(row.querySelector('.cell-date')?.textContent    || '').trim()}"`;
    const amount   = `"${(row.querySelector('.cell-amount')?.textContent  || '').replace(/[^0-9.]/g,'').trim()}"`;
    const status   = `"${row.dataset.status}"`;
    lines.push([title, client, type, platform, date, amount, status, note].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `earnings_${new Date().toISOString().split('T')[0]}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('CSV exported successfully!', 'success');
}
