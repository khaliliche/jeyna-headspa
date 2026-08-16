const tarifs = [
  { key: "decouverte", nom: "Découverte", duree: "30 min", prix: 180,
    desc: "Shampoing, massage crânien, séchage rapide",
    aliases: ["decouverte", "decouvert", "basic", "simple", "rapide", "1"] },
  { key: "eveil", nom: "Éveil Scalp", duree: "40 min", prix: 250,
    desc: "Soins du visage, shampoing, soin cheveux en profondeur, massage crânien",
    aliases: ["eveil", "eveilscalp", "scalp", "eveil scalp", "2"] },
  { key: "beldi", nom: "Rituel Beldi Naturel", duree: "50 min", prix: 300,
    desc: "Soins naturels au sidr/ghassoul, gommage du cuir chevelu, fumigation, massage crânien, massage des mains, soin du visage",
    aliases: ["beldi", "rituel", "naturel", "ghassoul", "sidr", "rituel beldi", "3"] },
  { key: "signature", nom: "Signature Jeyna", duree: "60 min", prix: 400,
    desc: "Soin hydratant, gommage du cuir chevelu, botox capillaire, fumigation, massage crânien approfondi, massage des mains, soin du visage",
    aliases: ["signature", "botox", "signature jeyna", "4"] },
  { key: "premium", nom: "Premium Jeyna", duree: "90 min", prix: 550,
    desc: "Rituel Head Spa complet, gommage du cuir chevelu, fumigation prolongée, massage crânien complet, massage nuque/épaules/mains, soin du visage",
    aliases: ["premium", "complet", "vip", "luxe", "premium jeyna", "5"] },
];

const DAY_NAMES_FULL = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const DAY_NAMES_LABEL = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

// ---------- Intent keyword banks (extend these anytime) ----------
const KW = {
  booking: ["reserv", "rendez", "rdv", "book", "prendre rdv", "jveux reserv", "je veux reserv", "prise de rdv", "planifier", "programmer un", "fixer un"],
  takenSlots: ["reserve", "occupe", "pris", "complet a", "plein", "quelles heures sont prises", "heures indisponibles", "quand c'est occupe", "deja pris"],
  freeSlots: ["dispo", "libre", "creneau", "place", "quand", "il reste", "reste il", "possible a", "vous avez de la place", "y a t il de la place"],
  price: ["prix", "tarif", "combien", "cout", "coute", "montant", "cest combien", "ca coute", "price", "cost"],
  address: ["adresse", "localisation", "position", "situe", "trouve", "quartier", "ou etes", "ou vous etes", "google maps", "map", "lieu", "adress"],
  hours: ["horaire", "ouvert", "ferme", "quand ouvre", "heure d'ouverture", "vous ouvrez", "jusqu'a quelle heure", "a quelle heure vous fermez"],
  greeting: ["bonjour", "salut", "slt", "hello", "hi", "bsr", "bonsoir", "cc", "coucou"],
  thanks: ["merci", "thanks", "thank you", "chokran"],
  cancel: ["annul", "stop", "laisse tomber", "oublie", "je change d'avis"]
};

function matchesAny(text, keywords) {
  return keywords.some(k => text.includes(normalize(k)));
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Dates de réservation sont TOUJOURS des chaînes "YYYY-MM-DD" en mémoire et
// en sessionStorage. Jamais un objet Date — c'est ce qui causait le bug où,
// après un refresh de page en pleine réservation, la date redevenait du
// texte au lieu d'un objet Date et cassait tout silencieusement.
function isoToDateObj(iso) {
  return new Date(iso + 'T00:00:00');
}

function getTuesdayWeekStartISO(targetISO) {
  const targetDate = isoToDateObj(targetISO);
  const day = targetDate.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(targetDate);
  monday.setDate(targetDate.getDate() - diffToMonday);
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);
  return formatDateISO(tuesday);
}

function detectServiceKey(q) {
  for (const t of tarifs) {
    if (t.aliases.some(a => q.includes(normalize(a)))) return t.key;
  }
  return null;
}

function detectDate(q) {
  const today = new Date();
  today.setHours(0,0,0,0);

  if (q.includes("aujourd") || q.includes("ajd")) return formatDateISO(today);
  if (q.includes("demain") || q.includes("dmn")) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return formatDateISO(d);
  }
  if (q.includes("apres demain") || q.includes("aprs demain")) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return formatDateISO(d);
  }

  for (let i = 0; i < DAY_NAMES_FULL.length; i++) {
    if (q.includes(DAY_NAMES_FULL[i])) {
      const d = new Date(today);
      const currentDay = d.getDay();
      let diff = (i - currentDay + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return formatDateISO(d);
    }
  }

  const dateMatch = q.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch) {
    // On ne devine JAMAIS l'année en silence. Avant, si la date tombait
    // dans le passé, le code sautait automatiquement à l'année suivante —
    // mais un même jour/mois tombe sur un jour de semaine différent d'une
    // année à l'autre, ce qui affichait un jour totalement faux (ex: le
    // 11/08 de cette année est un mardi, mais celui de l'année prochaine
    // est un mercredi). On retourne toujours la date de l'année en cours ;
    // si elle est passée, l'appelant doit le signaler clairement au client.
    const d = new Date(today.getFullYear(), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
    return formatDateISO(d);
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

async function fetchAvailabilityDay(serviceKey, targetISO) {
  const weekStart = getTuesdayWeekStartISO(targetISO);
  const res = await fetch(`/api/availability?weekStart=${weekStart}&service=${serviceKey}`);
  const data = await res.json();
  return data.days.find(d => d.date === targetISO);
}

async function checkAvailability(question, showTakenToo) {
  const q = normalize(question);
  const targetISO = detectDate(q);
  if (!targetISO) return "Précisez un jour 🙏 Exemple : \"dispo demain\", \"heures réservées mardi\".";
  const todayISO = formatDateISO(new Date(new Date().setHours(0,0,0,0)));
  if (targetISO < todayISO) return "Cette date est déjà passée 🙏 Donnez-moi une date à venir.";
  if (isoToDateObj(targetISO).getDay() === 1) return "Nous sommes fermés le lundi 🙏";

  const serviceUsed = detectServiceKey(q) || "decouverte";
  const serviceLabel = tarifs.find(t => t.key === serviceUsed)?.nom || "Découverte";

  try {
    const day = await fetchAvailabilityDay(serviceUsed, targetISO);
    if (!day) return "Jour introuvable, réessayez 🙏";

    const freeSlots = day.slots.filter(s => s.status === 'available').map(s => s.time);
    const takenSlots = day.slots.filter(s => s.status === 'full').map(s => s.time);

    let response = `<b>${day.label}</b> — <i>${serviceLabel}</i><br><br>`;
    response += freeSlots.length > 0
      ? `🟢 Libres : ${freeSlots.slice(0, 10).join(", ")}<br>`
      : `🟢 Libres : aucun créneau disponible<br>`;

    if (showTakenToo) {
      response += takenSlots.length > 0
        ? `🔴 Réservés : ${takenSlots.join(", ")}<br>`
        : `🔴 Réservés : aucun pour l'instant<br>`;
    }

    response += `<br>Tapez <i>"je veux réserver"</i> pour prendre rendez-vous directement ici.`;
    return response;
  } catch (e) {
    return "Erreur, réessayez dans un instant 🙏";
  }
}

function formatFrenchDate(isoDate) {
  const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const d = isoToDateObj(isoDate);
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

  if (matchesAny(q, KW.cancel)) {
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
    const dateISO = detectDate(q);
    if (!dateISO) return "Je n'ai pas compris la date. Essayez : \"demain\", \"mardi\", ou \"20/08\".";
    const todayISO = formatDateISO(new Date(new Date().setHours(0,0,0,0)));
    if (dateISO < todayISO) return "Cette date est déjà passée 🙏 Choisissez une date à venir.";
    if (isoToDateObj(dateISO).getDay() === 1) return "Nous sommes fermés le lundi 🙏 Choisissez un autre jour.";
    booking.date = dateISO;
    booking.step = 'time';

    const day = await fetchAvailabilityDay(booking.service, dateISO);
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
        date: booking.date,
        time: booking.time,
        name: booking.name,
        phone: booking.phone
      })
    });
    const data = await res.json();

    if (!res.ok) {
      // Créneau pris entre-temps (ex: quelqu'un d'autre vient de réserver).
      // On repasse à l'étape 'time' et on rafraîchit la liste des heures
      // libres pour ce jour, plutôt que de laisser l'utilisateur retaper
      // une heure qui ne sera de toute façon plus disponible.
      const failMsg = data.error || "Ce créneau vient d'être pris.";
      booking.step = 'time';
      try {
        const day = await fetchAvailabilityDay(booking.service, booking.date);
        const freeSlots = day.slots.filter(s => s.status === 'available').map(s => s.time);
        window.loadGrid?.();
        if (freeSlots.length === 0) {
          booking.step = 'date';
          return `${failMsg} Il ne reste plus aucun créneau libre ce jour-là 😔 Choisissez un autre jour.`;
        }
        return `${failMsg} Créneaux encore libres : ${freeSlots.join(", ")}<br>Quelle heure préférez-vous ?`;
      } catch (e2) {
        return `${failMsg} Donnez-moi une autre heure.`;
      }
    }

    const service = tarifs.find(t => t.key === booking.service);
    const dateFormatted = formatFrenchDate(booking.date);

    const message =
      `*Nouvelle réservation — Jeyna Head Spa*\n\n` +
      `Prestation : *${service.nom}* (${service.prix} MAD)\n` +
      `Date : *${dateFormatted}*\n` +
      `Heure : *${booking.time}*\n\n` +
      `Client : *${booking.name}*\n` +
      `Téléphone : *${booking.phone}*`;

    window.open(`https://wa.me/212669556345?text=${encodeURIComponent(message)}`, '_blank');

    // Rafraîchit la grille visuelle sur la même page pour que le créneau
    // apparaisse rouge immédiatement, sans que l'utilisateur ait besoin
    // de recharger la page. loadGrid() vient de js/reservation.js.
    window.loadGrid?.();

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

  if (matchesAny(q, KW.booking)) {
    return startBooking();
  }

  if (matchesAny(q, KW.takenSlots)) {
    return await checkAvailability(question, true);
  }

  if (matchesAny(q, KW.freeSlots)) {
    return await checkAvailability(question, false);
  }

  const trouve = tarifs.find(t => t.aliases.some(a => q.includes(normalize(a))));
  if (trouve) {
    return `<b>${trouve.nom}</b> — ${trouve.duree} — <b>${trouve.prix} MAD</b><br>${trouve.desc}`;
  }

  if (matchesAny(q, KW.price)) {
    return "Voici nos prestations :<br>" + tarifs.map(t => `• ${t.nom} (${t.duree}) — ${t.prix} MAD`).join("<br>");
  }

  if (matchesAny(q, KW.address)) {
    return "📍 Résidence Kouta, 1er étage, 4 rue Ibn Tammam, Kénitra, Maroc";
  }

  if (matchesAny(q, KW.hours)) {
    return "Nous sommes ouverts du mardi au dimanche, de 10h00 à 20h00. Fermé le lundi.";
  }

  if (matchesAny(q, KW.greeting)) {
    return "Bonjour 👋 Comment puis-je vous aider ? Vous pouvez demander les prix, les disponibilités, ou réserver directement.";
  }

  if (matchesAny(q, KW.thanks)) {
    return "Avec plaisir 🌸 N'hésitez pas si vous avez d'autres questions.";
  }

  return `Je n'ai pas compris 🙏 Vous pouvez demander : "prix Signature Jeyna", "dispo demain", "heures réservées mardi", ou tapez <i>"je veux réserver"</i>.`;
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

  function saveHistory() {
    const items = Array.from(messages.children).map(div => ({
      html: div.innerHTML,
      fromUser: div.classList.contains('self-end')
    }));
    sessionStorage.setItem('jeyna_chat_history', JSON.stringify(items));
    sessionStorage.setItem('jeyna_chat_booking', JSON.stringify(booking));
  }

  function addMsg(html, fromUser, skipSave) {
    const div = document.createElement("div");
    div.className = fromUser
      ? "bg-[#1F1B19] text-white self-end ml-auto rounded-sm px-3 py-2 mb-2 max-w-[80%]"
      : "bg-[#E8DED2] text-[#1F1B19] self-start rounded-sm px-3 py-2 mb-2 max-w-[80%]";
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    if (!skipSave) saveHistory();
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
    saveHistory();
  }

  send.addEventListener("click", handleSend);
  input.addEventListener("keypress", (e) => { if (e.key === "Enter") handleSend(); });

  const savedHistory = sessionStorage.getItem('jeyna_chat_history');
  const savedBooking = sessionStorage.getItem('jeyna_chat_booking');

  // Un ancien état de réservation stocké dans sessionStorage (par ex. testé
  // avant une mise à jour du code, ou une date mal formée) ne doit JAMAIS
  // être réutilisé tel quel : ça causait des dates fausses et de faux
  // "succès" de réservation sur une mauvaise date. On valide strictement
  // la forme avant de faire confiance à quoi que ce soit.
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const VALID_SERVICE_KEYS = tarifs.map(t => t.key);
  const VALID_STEPS = ['service', 'date', 'time', 'name', 'phone', 'confirming'];

  function isValidBookingState(b) {
    if (!b || typeof b !== 'object') return false;
    if (b.active === false) return true; // état vide/inactif toujours valide
    if (!VALID_STEPS.includes(b.step)) return false;
    if (b.service !== null && !VALID_SERVICE_KEYS.includes(b.service)) return false;
    if (b.date !== null && !ISO_DATE_RE.test(b.date)) return false;
    return true;
  }

  if (savedBooking) {
    try {
      const parsed = JSON.parse(savedBooking);
      if (isValidBookingState(parsed)) {
        booking = parsed;
      } else {
        resetBooking();
        sessionStorage.removeItem('jeyna_chat_booking');
      }
    } catch (e) {
      resetBooking();
      sessionStorage.removeItem('jeyna_chat_booking');
    }
  }

  function attachQuickBook() {
    const btn = document.getElementById('quick-book-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        addMsg("Réserver maintenant", true);
        const response = startBooking();
        addMsg(response, false);
      });
    }
  }

  function startFreshWelcome() {
    addMsg("Bonjour 👋 Je suis l'assistant Jeyna Head Spa. Demandez-moi les dispos, les heures déjà réservées, ou prenez rendez-vous directement ici.", false);
    addMsg('<button id="quick-book-btn" class="w-full bg-[#1F1B19] text-white rounded-sm py-2 text-sm mt-1">📅 Réserver maintenant</button>', false);
    attachQuickBook();
  }

  if (savedHistory) {
    try {
      const items = JSON.parse(savedHistory);
      items.forEach(item => addMsg(item.html, item.fromUser, true));
      attachQuickBook();
    } catch (e) {
      startFreshWelcome();
    }
  } else {
    startFreshWelcome();
  }
});