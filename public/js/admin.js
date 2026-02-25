// ==========================================
// S&G Man Hair Design - Admin Panel JS
// ==========================================

const API_BASE = '';

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

let allAppointments = [];
let settings = {};
let deleteTarget = null;

// DOM
const loginOverlay = document.getElementById('loginOverlay');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const appointmentsBody = document.getElementById('appointmentsBody');
const filterDate = document.getElementById('filterDate');
const clearFilter = document.getElementById('clearFilter');
const toast = document.getElementById('toast');
const confirmModal = document.getElementById('confirmModal');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');

// ==================== Login ====================

function checkLogin() {
    const loggedIn = sessionStorage.getItem('sg_admin_auth');
    if (loggedIn === 'true') {
        loginOverlay.classList.add('hidden');
        loadAll();
    }
}

async function handleLogin() {
    const password = loginPassword.value.trim();
    if (!password) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (res.ok) {
            sessionStorage.setItem('sg_admin_auth', 'true');
            loginOverlay.classList.add('hidden');
            loginError.classList.remove('show');
            loadAll();
        } else {
            loginError.classList.add('show');
            loginPassword.value = '';
            loginPassword.focus();
        }
    } catch (err) {
        showToast('Sunucu hatası.', 'error');
    }
}

// ==================== Data Loading ====================

async function loadAll() {
    await Promise.all([loadAppointments(), loadSettings()]);
}

async function loadAppointments(dateFilter = null) {
    try {
        let url = `${API_BASE}/api/appointments`;
        if (dateFilter) url += `?date=${dateFilter}`;
        const res = await fetch(url);
        allAppointments = await res.json();
        renderAppointments(allAppointments);
        updateStats();
    } catch (err) {
        console.error('Randevular yüklenemedi:', err);
    }
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        settings = await res.json();
        renderSettings();
    } catch (err) {
        console.error('Ayarlar yüklenemedi:', err);
    }
}

// ==================== Render Appointments ====================

function renderAppointments(appointments) {
    if (appointments.length === 0) {
        appointmentsBody.innerHTML = `<tr class="empty-row"><td colspan="6">Randevu bulunamadı.</td></tr>`;
        return;
    }

    let html = '';
    appointments.forEach(apt => {
        const dateFormatted = formatDateTR(apt.date);
        const phoneClean = apt.phone.replace(/\s/g, '').replace(/^0/, '90');
        const waLink = `https://wa.me/${phoneClean}`;

        html += `
      <tr>
        <td>${escapeHtml(apt.first_name)}</td>
        <td>${escapeHtml(apt.last_name)}</td>
        <td>${escapeHtml(apt.phone)}</td>
        <td>${dateFormatted}</td>
        <td>${apt.time}</td>
        <td class="actions-cell">
          <a href="${waLink}" target="_blank" class="btn-sm btn-whatsapp">💬 WhatsApp</a>
          <button class="btn-sm btn-danger" onclick="confirmDelete(${apt.id}, '${escapeHtml(apt.first_name)} ${escapeHtml(apt.last_name)}', '${apt.date}', '${apt.time}')">🗑 Sil</button>
        </td>
      </tr>
    `;
    });

    appointmentsBody.innerHTML = html;
}

function updateStats() {
    const today = new Date();
    const todayStr = formatDateISO(today);

    const todayCount = allAppointments.filter(a => a.date === todayStr).length;
    const upcomingCount = allAppointments.filter(a => a.date >= todayStr).length;
    const totalCount = allAppointments.length;

    document.getElementById('statToday').textContent = todayCount;
    document.getElementById('statUpcoming').textContent = upcomingCount;
    document.getElementById('statTotal').textContent = totalCount;
}

// ==================== Delete ====================

function confirmDelete(id, name, date, time) {
    deleteTarget = id;
    document.getElementById('confirmTitle').textContent = 'Randevuyu Sil';
    document.getElementById('confirmText').textContent = `${name} — ${formatDateTR(date)} ${time} randevusu silinecek. Emin misiniz?`;
    confirmModal.classList.remove('hidden');
}

async function handleDelete() {
    if (!deleteTarget) return;

    try {
        const res = await fetch(`${API_BASE}/api/appointments/${deleteTarget}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Randevu silindi.', 'success');
            confirmModal.classList.add('hidden');
            deleteTarget = null;
            loadAppointments(filterDate.value || null);
        } else {
            showToast('Silme işlemi başarısız.', 'error');
        }
    } catch (err) {
        showToast('Sunucu hatası.', 'error');
    }
}

// ==================== Settings ====================

function renderSettings() {
    // Working hours
    document.getElementById('workStart').value = settings.working_hours?.start || '10:00';
    document.getElementById('workEnd').value = settings.working_hours?.end || '20:00';

    // Weekly off days
    const weeklyDaysEl = document.getElementById('weeklyDays');
    const weeklyOff = settings.off_days?.weekly || [];
    let daysHtml = '';
    DAYS_TR.forEach((name, i) => {
        const checked = weeklyOff.includes(i);
        daysHtml += `
      <label class="day-checkbox ${checked ? 'checked' : ''}">
        <input type="checkbox" value="${i}" ${checked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('checked')">
        ${name}
      </label>
    `;
    });
    weeklyDaysEl.innerHTML = daysHtml;

    // Specific off dates
    renderOffDates();
}

function renderOffDates() {
    const list = document.getElementById('offDateList');
    const specificDates = settings.off_days?.specific || [];

    if (specificDates.length === 0) {
        list.innerHTML = '<span style="font-size:0.82rem; color:var(--text-muted);">Özel tatil tarihi yok.</span>';
        return;
    }

    let html = '';
    specificDates.sort().forEach(d => {
        html += `
      <div class="off-date-tag">
        ${formatDateTR(d)}
        <button class="off-date-tag__remove" onclick="removeOffDate('${d}')" title="Kaldır">×</button>
      </div>
    `;
    });
    list.innerHTML = html;
}

function addOffDate() {
    const input = document.getElementById('newOffDate');
    const date = input.value;
    if (!date) return;

    if (!settings.off_days) settings.off_days = { weekly: [], specific: [] };
    if (!settings.off_days.specific.includes(date)) {
        settings.off_days.specific.push(date);
        renderOffDates();
        input.value = '';
    }
}

function removeOffDate(date) {
    if (!settings.off_days?.specific) return;
    settings.off_days.specific = settings.off_days.specific.filter(d => d !== date);
    renderOffDates();
}

async function saveSettings() {
    // Gather working hours
    const workStart = document.getElementById('workStart').value;
    const workEnd = document.getElementById('workEnd').value;

    // Gather weekly off days
    const checkboxes = document.querySelectorAll('#weeklyDays input[type="checkbox"]');
    const weeklyOff = [];
    checkboxes.forEach(cb => {
        if (cb.checked) weeklyOff.push(parseInt(cb.value));
    });

    try {
        // Save working hours
        await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'working_hours', value: { start: workStart, end: workEnd } })
        });

        // Save off days
        await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: 'off_days',
                value: { weekly: weeklyOff, specific: settings.off_days?.specific || [] }
            })
        });

        showToast('Ayarlar başarıyla kaydedildi.', 'success');
    } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
    }
}

async function changePassword() {
    const newPw = document.getElementById('newPassword').value.trim();
    if (!newPw) {
        showToast('Lütfen yeni şifre girin.', 'error');
        return;
    }
    if (newPw.length < 4) {
        showToast('Şifre en az 4 karakter olmalıdır.', 'error');
        return;
    }

    try {
        await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'admin_password', value: newPw })
        });
        showToast('Şifre değiştirildi.', 'success');
        document.getElementById('newPassword').value = '';
    } catch (err) {
        showToast('Şifre değiştirilemedi.', 'error');
    }
}

// ==================== Tabs ====================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-nav__btn').forEach(b => b.classList.remove('active'));

    document.getElementById(tabName === 'appointments' ? 'tabAppointments' : 'tabSettings').classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// ==================== Utilities ====================

function formatDateTR(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast toast--${type} show`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// ==================== Event Listeners ====================

document.addEventListener('DOMContentLoaded', () => {
    checkLogin();

    loginBtn.addEventListener('click', handleLogin);
    loginPassword.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
    });

    // Tab navigation
    document.querySelectorAll('.admin-nav__btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Filter
    filterDate.addEventListener('change', () => {
        loadAppointments(filterDate.value || null);
    });
    clearFilter.addEventListener('click', () => {
        filterDate.value = '';
        loadAppointments();
    });

    // Delete confirm
    confirmOk.addEventListener('click', handleDelete);
    confirmCancel.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        deleteTarget = null;
    });

    // Settings
    document.getElementById('addOffDateBtn').addEventListener('click', addOffDate);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('changePasswordBtn').addEventListener('click', changePassword);
});
