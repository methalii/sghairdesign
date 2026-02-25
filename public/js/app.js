// ==========================================
// S&G Man Hair Design - Client App
// ==========================================

const API_BASE = '';

// Turkish month and day names
const MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];
const DAYS_TR = ['Pzr', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAYS_FULL_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// State
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedTime = null;
let settings = null;
let bookedSlots = [];

// DOM Elements
const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const timeslotsCard = document.getElementById('timeslotsCard');
const timeslotsGrid = document.getElementById('timeslotsGrid');
const timeslotsInfo = document.getElementById('timeslotsInfo');
const bookingCard = document.getElementById('bookingCard');
const bookingSummary = document.getElementById('bookingSummary');
const bookingForm = document.getElementById('bookingForm');
const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');

// ==================== Init ====================

async function init() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        settings = await res.json();
    } catch (err) {
        console.error('Settings yüklenemedi:', err);
        settings = {
            working_hours: { start: '10:00', end: '20:00' },
            off_days: { weekly: [0], specific: [] }
        };
    }
    renderCalendar();
    setupEventListeners();
}

// ==================== Calendar ====================

function renderCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = lastDay.getDate();

    calendarTitle.textContent = `${MONTHS_TR[currentMonth]} ${currentYear}`;

    let html = '';

    // Day headers (Mon-Sun)
    const dayOrder = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Pzr'];
    dayOrder.forEach(d => {
        html += `<div class="calendar-grid__header">${d}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div class="calendar-grid__day calendar-grid__day--empty"></div>`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = formatDate(date);
        const isToday = date.getTime() === today.getTime();
        const isPast = date < today;
        const dayOfWeek = date.getDay();
        const isOffDay = settings && settings.off_days && (
            settings.off_days.weekly.includes(dayOfWeek) ||
            settings.off_days.specific.includes(dateStr)
        );
        const isSelected = selectedDate === dateStr;

        let classes = 'calendar-grid__day';
        if (isToday) classes += ' calendar-grid__day--today';
        if (isSelected) classes += ' calendar-grid__day--selected';
        if (isPast) classes += ' calendar-grid__day--disabled';
        else if (isOffDay) classes += ' calendar-grid__day--off';

        const clickable = !isPast && !isOffDay;

        html += `<div class="${classes}" ${clickable ? `onclick="selectDate('${dateStr}')"` : ''} ${isOffDay ? 'title="Kapalı"' : ''}>${day}</div>`;
    }

    calendarGrid.innerHTML = html;
}

async function selectDate(dateStr) {
    selectedDate = dateStr;
    selectedTime = null;

    // Re-render calendar to update selected state
    renderCalendar();

    // Show time slots
    timeslotsCard.classList.add('active');
    bookingCard.classList.remove('active');

    // Fetch booked slots
    try {
        const res = await fetch(`${API_BASE}/api/appointments/booked/${dateStr}`);
        bookedSlots = await res.json();
    } catch (err) {
        console.error('Randevular yüklenemedi:', err);
        bookedSlots = [];
    }

    renderTimeSlots(dateStr);

    // Scroll to time slots
    timeslotsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== Time Slots ====================

function generateTimeSlots() {
    const slots = [];
    const start = settings?.working_hours?.start || '10:00';
    const end = settings?.working_hours?.end || '20:00';

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let h = startH;
    let m = startM;

    while (h < endH || (h === endH && m < endM)) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        m += 30;
        if (m >= 60) {
            h++;
            m = 0;
        }
    }

    return slots;
}

function renderTimeSlots(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = DAYS_FULL_TR[date.getDay()];
    const dayNum = date.getDate();
    const monthName = MONTHS_TR[date.getMonth()];

    timeslotsInfo.innerHTML = `📅 <strong>${dayNum} ${monthName} ${date.getFullYear()}</strong> — ${dayName}`;

    const slots = generateTimeSlots();
    let html = '';

    // Check if selected date is today to filter past times
    const today = new Date();
    const isToday = dateStr === formatDate(today);

    slots.forEach(time => {
        const isBooked = bookedSlots.includes(time);
        const isSelected = selectedTime === time;

        // If today, disable past time slots
        let isPastTime = false;
        if (isToday) {
            const [h, m] = time.split(':').map(Number);
            const slotDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
            isPastTime = slotDate <= today;
        }

        let classes = 'timeslot-btn';
        if (isBooked) classes += ' timeslot-btn--booked';
        if (isSelected) classes += ' timeslot-btn--selected';
        if (isPastTime) classes += ' timeslot-btn--booked';

        const disabled = isBooked || isPastTime;
        const label = isBooked ? `${time} (Dolu)` : time;

        html += `<button class="${classes}" ${disabled ? 'disabled' : `onclick="selectTime('${time}')"`} type="button">${label}</button>`;
    });

    timeslotsGrid.innerHTML = html;
}

function selectTime(time) {
    selectedTime = time;

    // Re-render to update selected state
    renderTimeSlots(selectedDate);

    // Show booking form
    showBookingForm();
}

// ==================== Booking Form ====================

function showBookingForm() {
    bookingCard.classList.add('active');

    const date = new Date(selectedDate + 'T00:00:00');
    const dayName = DAYS_FULL_TR[date.getDay()];
    const dayNum = date.getDate();
    const monthName = MONTHS_TR[date.getMonth()];

    bookingSummary.innerHTML = `
    <div class="booking-summary__item">
      <span class="booking-summary__label">📅 Tarih:</span>
      <span class="booking-summary__value">${dayNum} ${monthName} ${date.getFullYear()} (${dayName})</span>
    </div>
    <div class="booking-summary__item">
      <span class="booking-summary__label">🕐 Saat:</span>
      <span class="booking-summary__value">${selectedTime}</span>
    </div>
  `;

    bookingCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleBooking(e) {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!firstName || !lastName || !phone) {
        showToast('Lütfen tüm alanları doldurun.', 'error');
        return;
    }

    if (!selectedDate || !selectedTime) {
        showToast('Lütfen tarih ve saat seçin.', 'error');
        return;
    }

    // Validate phone (basic Turkish format)
    const phoneClean = phone.replace(/\s/g, '');
    if (!/^0?5\d{9}$/.test(phoneClean) && !/^\+?905\d{9}$/.test(phoneClean)) {
        showToast('Geçerli bir telefon numarası girin (05XX XXX XX XX).', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Randevu oluşturuluyor...';

    try {
        const res = await fetch(`${API_BASE}/api/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                phone: phoneClean,
                date: selectedDate,
                time: selectedTime
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('✅ Randevunuz başarıyla oluşturuldu!', 'success');

            // Reset form
            bookingForm.reset();
            bookingCard.classList.remove('active');
            selectedTime = null;

            // Refresh booked slots
            const bookedRes = await fetch(`${API_BASE}/api/appointments/booked/${selectedDate}`);
            bookedSlots = await bookedRes.json();
            renderTimeSlots(selectedDate);
        } else {
            showToast(data.error || 'Bir hata oluştu.', 'error');
        }
    } catch (err) {
        showToast('Sunucu hatası. Lütfen tekrar deneyin.', 'error');
        console.error(err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✂️ Randevuyu Onayla';
    }
}

// ==================== Utilities ====================

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast toast--${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ==================== Event Listeners ====================

function setupEventListeners() {
    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    bookingForm.addEventListener('submit', handleBooking);

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        // Format as 05XX XXX XX XX
        if (value.length > 4 && value.length <= 7) {
            value = value.slice(0, 4) + ' ' + value.slice(4);
        } else if (value.length > 7 && value.length <= 9) {
            value = value.slice(0, 4) + ' ' + value.slice(4, 7) + ' ' + value.slice(7);
        } else if (value.length > 9) {
            value = value.slice(0, 4) + ' ' + value.slice(4, 7) + ' ' + value.slice(7, 9) + ' ' + value.slice(9);
        }

        e.target.value = value;
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
