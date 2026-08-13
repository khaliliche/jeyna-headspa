import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const SERVICES = {
  decouverte: { label: "Découverte", slots: 2 },
  eveil: { label: "Éveil Scalp", slots: 2 },
  beldi: { label: "Rituel Beldi Naturel", slots: 2 },
  signature: { label: "Signature Jeyna", slots: 3 },
  premium: { label: "Premium Jeyna", slots: 4 },
};

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = 20; // 10:00 -> 20:00
const DAY_NAMES = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

function slotTime(index) {
  const totalMin = 10 * 60 + index * SLOT_MINUTES;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function timeToSlotIndex(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return Math.round(((h * 60 + m) - 10 * 60) / SLOT_MINUTES);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function handler(req, res) {
  try {
    const { weekStart, service } = req.query;
    if (!weekStart || !service || !SERVICES[service]) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    const durationSlots = SERVICES[service].slots;

    const start = new Date(weekStart + 'T00:00:00');
    const dates = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(formatDate(d));
    }

    const rows = await sql`
      SELECT to_char(date, 'YYYY-MM-DD') as date, start_time, duration_min
      FROM reservations
      WHERE date = ANY(${dates}::date[])
    `;

    const days = dates.map((date) => {
      const counts = new Array(SLOTS_PER_DAY).fill(0);
      for (const row of rows) {
        if (row.date === date) {
          const startIdx = timeToSlotIndex(String(row.start_time).slice(0,5));
          const span = Math.round(row.duration_min / SLOT_MINUTES);
          for (let j = startIdx; j < startIdx + span && j < SLOTS_PER_DAY; j++) {
            if (j >= 0) counts[j]++;
          }
        }
      }

      const slots = [];
      for (let i = 0; i < SLOTS_PER_DAY; i++) {
        let status;
        if (i + durationSlots > SLOTS_PER_DAY) {
          status = 'unavailable';
        } else {
          let ok = true;
          for (let j = i; j < i + durationSlots; j++) {
            if (counts[j] >= 1) { ok = false; break; }
          }
          status = ok ? 'available' : 'full';
        }
        slots.push({ time: slotTime(i), status });
      }

      const dObj = new Date(date + 'T00:00:00');
      const label = `${DAY_NAMES[dObj.getDay()]} ${String(dObj.getDate()).padStart(2,'0')}/${String(dObj.getMonth()+1).padStart(2,'0')}`;

      return { date, label, slots };
    });

    res.status(200).json({ days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', detail: String(err.message || err) });
  }
}