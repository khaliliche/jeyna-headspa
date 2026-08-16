const tarifs = [
  { key: "decouverte", nom: "Découverte", duree: "30 min", prix: 180,
    desc: "Shampoing, massage crânien, séchage rapide" },
  { key: "eveil", nom: "Éveil Scalp", duree: "40 min", prix: 250,
    desc: "Soins du visage, shampoing, soin cheveux en profondeur, massage crânien" },
  { key: "beldi", nom: "Rituel Beldi Naturel", duree: "50 min", prix: 300,
    desc: "Soins naturels au sidr/ghassoul, gommage du cuir chevelu, fumigation, massage crânien, massage des mains, soin du visage" },
  { key: "signature", nom: "Signature Jeyna", duree: "60 min", prix: 400,
    desc: "Soin hydratant, gommage du cuir chevelu, botox capillaire, fumigation, massage crânien approfondi, massage des mains, soin du visage" },
  { key: "premium", nom: "Premium Jeyna", duree: "90 min", prix: 550,
    desc: "Rituel Head Spa complet, gommage du cuir chevelu, fumigation prolongée, massage crânien complet, massage nuque/épaules/mains, soin du visage" },
];

const DAY_NAMES_FULL = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const DAY_NAMES_LABEL = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTuesdayWeekStart(targetDate) {
  const day = targetDate.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(targetDate);
  monday.setDate(targetDate.getDate() - diffToMonday);
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);
  return tuesday;
}

function detectServiceKey(q) {
  const numMatch = q.match(/^[1-5]$/);
  if (numMatch) return tarifs[parseInt(numMatch[0]) - 1].key;
  for (const t of tarifs) {
    if (q.includes(normalize(t.nom.split(" ")[0])) || q.includes(normalize(t.nom))) {
      return t.key;
    }
  }
  return null;
}

function detectDate(q) {
  const today = new Date();
  today.setHours(0,0,0,0);

  if (q.includes("aujourd")) return today;
  if (q.includes("demain")) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d;
  }

  for (let i = 0; i < DAY_NAMES_FULL.length; i++) {
    if (q.includes(DAY_NAMES_FULL[i])) {
      const d = new Date(today);
      const currentDay = d.getDay();
      let diff = (i - currentDay + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  const dateMatch = q.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch) {
    const d = new Date(today.getFullYear(), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  return null;
}

function normalizeTimeInput(q) {
  const clean = q.replace(/\s/g, '').replace('h', ':');
  const match = clean.match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!match) return null;
  const h = parseInt(match[1]);
  const m = match[2] ? parseInt(match[2]) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

async function fetchAvailabilityDay(serviceKey, targetDate) {
  const weekStart = formatDateISO(getTuesdayWeekStart(targetDate));
  const res = await fetch(`/api/availability?weekStart=${weekStart}&service=${serviceKey}`);
  const data = await res.json();
  const targetISO = formatDateISO(targetDate);
  return data.days.find(d => d.date === targetISO);
}

// ---------- Simple price/info lookup (non-booking questions) ----------
async function checkAvailability(question) {
  const q = normalize(question);
  const targetDate = detectDate(q);
  if (!targetDate) return "Précisez un jour 🙏 Exemple : \"dispo demain\", \"places libres mardi\".";
  if (targetDate.getDay() === 1) return "Nous sommes fermés le lundi 🙏";

  const serviceUsed = detectServiceKey(q) || "decouverte";
  const serviceLabel = tarifs.find(t => t.key === serviceUsed)?.nom || "Découverte";

  try {
    const day = await fetchAvailabilityDay(serviceUsed, targetDate);
    if (!day) return "Jour introuvable, réessayez 🙏";
    const freeSlots = day.slots.filter(s => s.status === 'available').map(s => s.time);
    if (freeSlots.length === 0) {
      return `Aucun créneau libre le <b>${day.label}</b> pour <b>${serviceLabel}</b> 😔`;
    }
    const shown = freeSlots.slice(0, 8).join(", ");
    return `Le <b>${day.label}</b>, pour <b>${serviceLabel}</b> :<br>🟢 ${shown}<br><br>Tapez <i>"je veux réserver"</i> pour prendre rendez-vous directement ici.`;
  } catch (e) {
    return "Erreur, réessayez dans un instant 🙏";
  }
}

function formatFrenchDate(isoDate) {
  const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const d = new Date(isoDate + 'T00:00:00');
  return `${DAY_NAMES_LABEL[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- Guided booking conversation ----------
let booking = { active: false, step: null, service: null, date: null, time: null, name: null, phone: null };

function resetBooking() {
  booking = { active: false, step: null, service: null, date: null, time: null, name: null, phone: null };
}

function serviceListText() {
  return tarifs.map((t, i) => `${i + 1}. ${t.nom} — ${t.duree} — ${t.prix} MAD`).join("<br>");
}

function startBooking() {
  booking = { active: true, step: 'service', service: null, date: null, time: null, name: null, phone: null };
  return `Parfait, réservons ensemble 🌸<br>Quelle prestation souhaitez-vous ?<br>${serviceListText()}<br><br><i>(tapez le nom ou le numéro)</i>`;
}

async function handleBookingStep(input) {
  const q = normalize(input);

  if (q.includes("annul") || q === "stop") {
    resetBooking();
    return "Réservation annulée. Dites-moi si vous voulez recommencer 🙏";
  }

  if (booking.step === 'service') {
    const key = detectServiceKey(q);
    if (!key) return `Je n'ai pas reconnu cette prestation. Choisissez parmi :<br>${serviceListText()}`;
    booking.service = key;
    booking.step = 'date';
    return `Très bien : <b>${tarifs.find(t => t.key === key).nom}</b>.<br>Quel jour souhaitez-vous ? <i>(ex: demain, mardi, 20/08)</i>`;
  }

  if (booking.step === 'date') {
    const date = detectDate(q);
    if (!date) return "Je n'ai pas compris la date. Essayez : \"demain\", \"mardi\", ou \"20/08\".";
    if (date.getDay() === 1) return "Nous sommes fermés le lundi 🙏 Choisissez un autre jour.";
    booking.date = date;
    booking.step = 'time';

    const day = await fetchAvailabilityDay(booking.service, date);
    const freeSlots = day.slots.filter(s => s.status === 'available').map(s => s.time);
    if (freeSlots.length === 0) {
      booking.step = 'date';
      return `Aucun créneau libre le ${day.label} pour cette prestation 😔 Choisissez un autre jour.`;
    }
    return `Le <b>${day.label}</b>, voici les créneaux libres :<br>🟢 ${freeSlots.join(", ")}<br><br>Quelle heure préférez-vous ?`;
  }

  if (booking.step === 'time') {
    const time = normalizeTimeInput(q);
    if (!time) return "Format non reconnu. Exemple : \"14:00\" ou \"14h30\".";

    const day = await fetchAvailabilityDay(booking.service, booking.date);
    const slot = day.slots.find(s => s.time === time);

    if (!slot) return "Cette heure n'existe pas dans nos horaires (10:00 à 19:30). Réessayez.";
    if (slot.status !== 'available') {
      const freeSlots = day.slots.filter(s => s.status === 'available').map(s => s.time);
      if (freeSlots.length === 0) return "Ce créneau est complet, et plus aucun n'est libre ce jour-là 😔 Choisissez un autre jour.";
      return `Ce créneau est complet 😔 Créneaux encore libres : ${freeSlots.join(", ")}<br>Quelle heure préférez-vous ?`;
    }

    booking.time = time;
    booking.step = 'name';
    return "Parfait, ce créneau est libre ✓<br>Quel est votre nom complet ?";
  }

  if (booking.step === 'name') {
    if (input.trim().length < 2) return "Merci d'indiquer votre nom complet.";
    booking.name = input.trim();
    booking.step = 'phone';
    return "Et votre numéro de téléphone ?";
  }

  if (booking.step === 'phone') {
    if (input.trim().length < 8) return "Merci d'indiquer un numéro de téléphone valide.";
    booking.phone = input.trim();
    booking.step = 'confirming';
    return await finalizeBooking();
  }

  return "Dites-moi si vous voulez continuer ou tapez \"annuler\".";
}

async function finalizeBooking() {
  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: booking.service,
        date: formatDateISO(booking.date),
        time: booking.time,
        name: booking.name,
        phone: booking.phone
      })
    });
    const data = await res.json();

    if (!res.ok) {
      const failMsg = data.error || "Ce créneau vient d'être pris.";
      booking.step = 'time';
      return `${failMsg} Donnez-moi une autre heure.`;
    }

    const service = tarifs.find(t => t.key === booking.service);
    const dateFormatted = formatFrenchDate(formatDateISO(booking.date));

    const message =
      `*Nouvelle réservation — Jeyna Head Spa*\n\n` +
      `Prestation : *${service.nom}* (${service.prix} MAD)\n` +
      `Date : *${dateFormatted}*\n` +
      `Heure : *${booking.time}*\n\n` +
      `Client : *${booking.name}*\n` +
      `Téléphone : *${booking.phone}*`;

    window.open(`https://wa.me/212669556345?text=${encodeURIComponent(message)}`, '_blank');

    const summary = `Réservation confirmée ✓<br><b>${service.nom}</b> — ${dateFormatted} à ${booking.time}<br>Un message WhatsApp s'ouvre pour finaliser avec nous.`;
    resetBooking();
    return summary;
  } catch (e) {
    booking.step = 'time';
    return "Erreur réseau, réessayez avec une autre heure.";
  }
}

// ---------- Main router ----------
async function repondre(question) {
  const q = normalize(question);

  if (booking.active) {
    return await handleBookingStep(question);
  }

  if (q.includes("reserv") || q.includes("rendez") || q.includes("rdv")) {
    return startBooking();
  }

  if (q.includes("dispo") || q.includes("libre") || q.includes("creneau") || (q.includes("place") && !q.includes("remplace"))) {
    return await checkAvailability(question);
  }

  const trouve = tarifs.find(t => q.includes(normalize(t.nom.split(" ")[0])) || q.includes(normalize(t.nom)));
  if (trouve) {
    return `<b>${trouve.nom}</b> — ${trouve.duree} — <b>${trouve.prix} MAD</b><br>${trouve.desc}`;
  }

  if (q.includes("prix") || q.includes("tarif") || q.includes("combien") || q.includes("liste")) {
    return "Voici nos prestations :<br>" + tarifs.map(t => `• ${t.nom} (${t.duree}) — ${t.prix} MAD`).join("<br>");
  }

  if (q.includes("adresse") || q.includes("ou") || q.includes("localisation")) {
    return "📍 Résidence Kouta, 1er étage, 4 rue Ibn Tammam, Kénitra, Maroc";
  }

  if (q.includes("horaire") || q.includes("ouvert")) {
    return "Nous sommes ouverts du mardi au dimanche, de 10h00 à 20h00. Fermé le lundi.";
  }

  return `Je n'ai pas compris 🙏 Vous pouvez demander : "prix Signature Jeyna", "dispo demain", ou tapez <i>"je veux réserver"</i> pour prendre rendez-vous directement ici.`;
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("chat-toggle");
  const box = document.getElementById("chat-box");
  const messages = document.getElementById("chat-messages");
  const input = document.getElementById("chat-input");
  const send = document.getElementById("chat-send");

  if (!toggle) return;

  const sign = document.getElementById("chat-sign");

  toggle.addEventListener("click", () => {
    box.classList.toggle("hidden");
    if (sign) sign.classList.toggle("hidden");
  });

  const closeBtn = document.getElementById("chat-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      box.classList.add("hidden");
      if (sign) sign.classList.remove("hidden");
    });
  }

  function addMsg(html, fromUser) {
    const div = document.createElement("div");
    div.className = fromUser
      ? "bg-[#1F1B19] text-white self-end ml-auto rounded-sm px-3 py-2 mb-2 max-w-[80%]"
      : "bg-[#E8DED2] text-[#1F1B19] self-start rounded-sm px-3 py-2 mb-2 max-w-[80%]";
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function handleSend() {
    const val = input.value.trim();
    if (!val) return;
    addMsg(val, true);
    input.value = "";
    addMsg("...", false);
    const thinkingMsg = messages.lastChild;
    const response = await repondre(val);
    thinkingMsg.innerHTML = response;
    messages.scrollTop = messages.scrollHeight;
  }

  send.addEventListener("click", handleSend);
  input.addEventListener("keypress", (e) => { if (e.key === "Enter") handleSend(); });

  addMsg("Bonjour 👋 Je suis l'assistant Jeyna Head Spa. Je peux répondre à vos questions ou prendre votre rendez-vous directement ici.", false);
  addMsg('<button id="quick-book-btn" class="w-full bg-[#1F1B19] text-white rounded-sm py-2 text-sm mt-1">📅 Réserver maintenant</button>', false);
  document.getElementById('quick-book-btn').addEventListener('click', async () => {
    addMsg("Réserver maintenant", true);
    const response = startBooking();
    addMsg(response, false);
  });
});