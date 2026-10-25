/**
 * EarnFlow - Freelance & Project Earnings Dashboard Client Script
 * Handles real-time charts, CRUD operations, filters, and CSV export.
 */

let monthlyChart = null;
let platformChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // Set default date for Add Modal
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('new-date');
    if (dateInput) {
        dateInput.value = today;
    }

    // Initialize Charts
    initCharts();
});

// Toast notification helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-in`;

    let icon = 'fa-circle-check';
    if (type === 'danger') icon = 'fa-circle-exclamation';
    else if (type === 'warning') icon = 'fa-triangle-exclamation';
    else if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 4500);
}

// Modal handling
function openAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) {
        modal.classList.add('open');
        document.getElementById('new-title').focus();
    }
}

function closeAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) modal.classList.remove('open');
}

function closeModalOnBackdrop(e) {
    if (e.target.id === 'add-modal') {
        closeAddModal();
    }
}

function updateStreamUI(type) {
    const optProj = document.getElementById('opt-project');
    const optFree = document.getElementById('opt-freelance');
    if (type === 'project') {
        optProj.classList.add('active');
        optFree.classList.remove('active');
    } else {
        optFree.classList.add('active');
        optProj.classList.remove('active');
    }
}

// Chart.js initialization & live updates
async function initCharts() {
    try {
        const res = await fetch('/api/analytics');
        const data = await res.json();

        if (!data.success) return;

        renderMonthlyTrendChart(data.monthly);
        renderPlatformChart(data.platforms);
    } catch (err) {
        console.error('Failed to load chart analytics:', err);
    }
}

function renderMonthlyTrendChart(monthlyData) {
    const ctx = document.getElementById('monthlyTrendChart');
    if (!ctx) return;

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthlyData.labels,
            datasets: [
                {
                    label: 'Project Revenue',
                    data: monthlyData.project,
                    backgroundColor: 'rgba(99, 102, 241, 0.85)',
                    hoverBackgroundColor: '#818cf8',
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.65,
                    categoryPercentage: 0.7
                },
                {
                    label: 'Freelance Revenue',
                    data: monthlyData.freelance,
                    backgroundColor: 'rgba(14, 165, 233, 0.85)',
                    hoverBackgroundColor: '#38bdf8',
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.65,
                    categoryPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: '#94a3b8',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '500' }
                    }
                },
                y: {
                    grid: { color: 'rgba(51, 65, 85, 0.4)' },
                    ticks: {
                        color: '#64748b',
                        callback: (value) => '$' + value.toLocaleString(),
                        font: { family: "'JetBrains Mono', monospace", size: 11 }
                    }
                }
            }
        }
    });
}

function renderPlatformChart(platformData) {
    const ctx = document.getElementById('platformPieChart');
    if (!ctx) return;

    if (platformChart) {
        platformChart.destroy();
    }

    const vibrantPalette = [
        '#6366f1', // Indigo (Direct)
        '#0ea5e9', // Sky (Upwork)
        '#10b981', // Emerald (Fiverr)
        '#f59e0b', // Amber (Toptal)
        '#ec4899', // Pink (Freelancer)
        '#8b5cf6'  // Purple (Other)
    ];

    platformChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: platformData.labels,
            datasets: [{
                data: platformData.values,
                backgroundColor: vibrantPalette.slice(0, platformData.labels.length),
                borderColor: '#131b2e',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 14,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed;
                            return ' ' + context.label + ': $' + val.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Submit New Earning Form
async function submitNewEarning(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-earning');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const form = document.getElementById('add-earning-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/earnings/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const res = await response.json();
        if (res.success) {
            showToast('Earning added successfully!', 'success');
            closeAddModal();
            form.reset();
            // Reset stream UI
            updateStreamUI('project');
            // Reload page to update entire KPI card numbers and charts cleanly
            window.location.reload();
        } else {
            showToast(res.message || 'Error adding entry', 'danger');
        }
    } catch (err) {
        showToast('Network error while saving.', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Earning';
    }
}

// Toggle Status (Paid <-> Pending)
async function toggleStatus(recordId, currentStatus) {
    const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid';

    try {
        const res = await fetch(`/api/earnings/${recordId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus })
        });

        const data = await res.json();
        if (data.success) {
            showToast(`Status updated to ${nextStatus.toUpperCase()}`, 'info');
            // Reload to recalculate total earned, pending, and update charts
            window.location.reload();
        } else {
            showToast('Failed to update status', 'danger');
        }
    } catch (err) {
        showToast('Error communicating with server', 'danger');
    }
}

// Delete Record
async function deleteRecord(recordId) {
    if (!confirm('Are you sure you want to delete this earnings record?')) {
        return;
    }

    try {
        const res = await fetch(`/api/earnings/${recordId}/delete`, {
            method: 'POST'
        });

        const data = await res.json();
        if (data.success) {
            showToast('Record deleted successfully', 'success');
            const row = document.querySelector(`tr[data-id="${recordId}"]`);
            if (row) {
                row.remove();
                // Update row count badge
                updateRecordCount();
            }
            // Refresh charts
            initCharts();
        } else {
            showToast(data.message || 'Error deleting entry', 'danger');
        }
    } catch (err) {
        showToast('Network error while deleting.', 'danger');
    }
}

// Filters (All, Project, Freelance, Paid, Pending)
function filterRecords(type, btn) {
    // Update active pill button
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const rows = document.querySelectorAll('#earnings-tbody .table-row');
    rows.forEach(row => {
        const rowType = row.dataset.type;
        const rowStatus = row.dataset.status;

        if (type === 'all') {
            row.style.display = '';
        } else if (type === 'project' || type === 'freelance') {
            row.style.display = (rowType === type) ? '' : 'none';
        } else if (type === 'paid' || type === 'pending') {
            row.style.display = (rowStatus === type) ? '' : 'none';
        }
    });

    updateRecordCount();
}

// Live Search Filter
function searchRecords(query) {
    const q = query.trim().toLowerCase();
    const rows = document.querySelectorAll('#earnings-tbody .table-row');
    
    rows.forEach(row => {
        const searchContent = (row.dataset.search || '').toLowerCase();
        if (!q || searchContent.includes(q)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });

    updateRecordCount();
}

function updateRecordCount() {
    const visibleRows = document.querySelectorAll('#earnings-tbody .table-row:not([style*="display: none"])');
    const badge = document.getElementById('record-count');
    if (badge) {
        badge.textContent = visibleRows.length;
    }
}

// Export to CSV
function exportToCSV() {
    const rows = document.querySelectorAll('#earnings-tbody .table-row');
    if (rows.length === 0) {
        showToast('No records available to export', 'warning');
        return;
    }

    const headers = ['Title', 'Client', 'Stream Type', 'Platform', 'Date', 'Amount', 'Status', 'Notes'];
    const csvContent = [];
    csvContent.push(headers.join(','));

    rows.forEach(row => {
        const title = `"${row.querySelector('.project-name')?.textContent.trim() || ''}"`;
        const notes = `"${row.querySelector('.project-notes')?.textContent.replace(/[\n\r]+/g, ' ').trim() || ''}"`;
        const client = `"${row.querySelector('.client-cell span')?.textContent.trim() || ''}"`;
        const streamType = `"${row.dataset.type || ''}"`;
        const platform = `"${row.querySelector('.platform-tag')?.textContent.trim() || ''}"`;
        const date = `"${row.querySelector('.date-cell')?.textContent.trim() || ''}"`;
        const amount = `"${row.querySelector('.amount-cell')?.textContent.replace(/[^0-9.]/g, '') || ''}"`;
        const status = `"${row.dataset.status || ''}"`;

        csvContent.push([title, client, streamType, platform, date, amount, status, notes].join(','));
    });

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported CSV successfully!', 'success');
}
