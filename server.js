const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== JSON File Database ====================
// Dosyanın en üstündeki 'fs' ve 'path' kısımlarını silebilirsin.
import { kv } from '@vercel/kv'; 

// ==================== Vercel KV Database ====================
const DB_KEY = 'appointment_data';

async function loadDB() {
   
    const data = await kv.get(DB_KEY);
    
    if (!data) {
        return {
            appointments: [],
            settings: {
                working_hours: { start: '10:00', end: '20:00' },
                off_days: { weekly: [0], specific: [] },
                admin_password: 'sg2024'
            },
            nextId: 1
        };
    }
    return data;
}

async function saveDB(data) {

    await kv.set(DB_KEY, data);
}

// ==================== API ROUTES ====================

// --- Appointments ---

// GET all appointments (optionally filter by date)
app.get('/api/appointments', (req, res) => {
    try {
        const db = loadDB();
        const { date } = req.query;
        let appointments = db.appointments;
        if (date) {
            appointments = appointments.filter(a => a.date === date);
        }
        appointments.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET booked times for a specific date
app.get('/api/appointments/booked/:date', (req, res) => {
    try {
        const db = loadDB();
        const { date } = req.params;
        const booked = db.appointments
            .filter(a => a.date === date)
            .map(a => a.time);
        res.json(booked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create appointment
app.post('/api/appointments', (req, res) => {
    try {
        const db = loadDB();
        const { first_name, last_name, phone, date, time } = req.body;

        // Validation
        if (!first_name || !last_name || !phone || !date || !time) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        // Check if slot is already booked
        const existing = db.appointments.find(a => a.date === date && a.time === time);
        if (existing) {
            return res.status(409).json({ error: 'Bu saat dilimi zaten dolu.' });
        }

        // Check if date is an off-day
        const offDays = db.settings.off_days;
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();

        if (offDays.weekly.includes(dayOfWeek)) {
            return res.status(400).json({ error: 'Bu gün tatil günüdür.' });
        }
        if (offDays.specific.includes(date)) {
            return res.status(400).json({ error: 'Bu tarih tatil olarak ayarlanmıştır.' });
        }

        // Check if time is within working hours
        const wh = db.settings.working_hours;
        if (time < wh.start || time >= wh.end) {
            return res.status(400).json({ error: 'Bu saat çalışma saatleri dışındadır.' });
        }

        const appointment = {
            id: db.nextId++,
            first_name,
            last_name,
            phone,
            date,
            time,
            created_at: new Date().toISOString()
        };

        db.appointments.push(appointment);
        saveDB(db);

        res.status(201).json(appointment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE appointment
app.delete('/api/appointments/:id', (req, res) => {
    try {
        const db = loadDB();
        const id = parseInt(req.params.id);
        const index = db.appointments.findIndex(a => a.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Randevu bulunamadı.' });
        }
        db.appointments.splice(index, 1);
        saveDB(db);
        res.json({ message: 'Randevu silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Settings ---

// GET all settings
app.get('/api/settings', (req, res) => {
    try {
        const db = loadDB();
        res.json(db.settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update settings
app.put('/api/settings', (req, res) => {
    try {
        const db = loadDB();
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Key ve value zorunludur.' });
        }
        db.settings[key] = value;
        saveDB(db);
        res.json({ message: 'Ayar güncellendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin password verification
app.post('/api/admin/verify', (req, res) => {
    try {
        const db = loadDB();
        const { password } = req.body;
        if (db.settings.admin_password === password) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, error: 'Yanlış şifre.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback routes for SPA
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✂️  S&G Hair Design server running at http://localhost:${PORT}`);
    console.log(`📋 Admin panel: http://localhost:${PORT}/admin.html`);
});

