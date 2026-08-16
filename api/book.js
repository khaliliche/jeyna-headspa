import { Pool } from '@neondatabase/serverless';

const SERVICES = {
  decouverte: { label: "Découverte", slots: 2 },
  eveil: { label: "Éveil Scalp", slots: 2 },
  beldi: { label: "Rituel Beldi Naturel", slots: 2 },
  signature: { label: "Signature Jeyna", slots: 3 },
  premium: { label: "Premium Jeyna", slots: 4 },
};

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = 20;

function timeToSlotIndex(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return Math.round(((h * 60 + m) - 10 * 60) / SLOT_MINUTES);
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { service, date, time, name, phone } = req.body;

  if (!service || !SERVICES[service] || !date || !time || !name || !phone) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const dObj = new Date(date + 'T00:00:00');
  if (dObj.getDay() === 1) {
    return res.status(400).json({ error: 'Fermé le lundi' });
  }

  const durationSlots = SERVICES[service].slots;
  const durationMin = durationSlots * SLOT_MINUTES;
  const startIdx = timeToSlotIndex(time);

  if (startIdx < 0 || startIdx + durationSlots > SLOTS_PER_DAY) {
    return res.status(400).json({ error: 'Créneau invalide' });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verrouille cette date précise pendant toute la transaction.
    // Si une autre requête (chat OU grille visuelle) essaie de réserver
    // la même date en même temps, elle attend que celle-ci finisse
    // (COMMIT ou ROLLBACK) avant de vérifier la disponibilité.
    // C'est ce qui empêche le double-booking, même en cas de clics simultanés.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [date]);

    const { rows: existing } = await client.query(
      'SELECT start_time, duration_min FROM reservations WHERE date = $1::date',
      [date]
    );

    const counts = new Array(SLOTS_PER_DAY).fill(0);
    for (const row of existing) {
      const s = timeToSlotIndex(String(row.start_time).slice(0, 5));
      const span = Math.round(row.duration_min / SLOT_MINUTES);
      for (let j = s; j < s + span && j < SLOTS_PER_DAY; j++) {
        if (j >= 0) counts[j]++;
      }
    }

    let conflict = false;
    for (let j = startIdx; j < startIdx + durationSlots; j++) {
      if (counts[j] >= 1) { conflict = true; break; }
    }

    if (conflict) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "Ce créneau vient d'être pris, choisissez-en un autre." });
    }

    const poste = 1;
    const startTime = `${time}:00`;
    const endTime = addMinutes(time, durationMin);

    await client.query(
      `INSERT INTO reservations (service, duration_min, date, start_time, end_time, poste, name, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [service, durationMin, date, startTime, endTime, poste, name, phone]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      summary: { service: SERVICES[service].label, date, time }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
    await pool.end();
  }
}