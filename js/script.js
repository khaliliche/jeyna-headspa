const form = document.getElementById('reservation-form');

if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const service = document.getElementById('service').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const note = document.getElementById('note').value;

    const message =
      `Bonjour Jeyna Head Spa 🌸%0A` +
      `Je souhaite réserver :%0A` +
      `Prestation : ${service}%0A` +
      `Date : ${date}%0A` +
      `Heure : ${time}%0A` +
      `Nom : ${name}%0A` +
      `Téléphone : ${phone}%0A` +
      (note ? `Remarque : ${note}%0A` : '');

    const whatsappUrl = `https://wa.me/212669556345?text=${message}`;
    window.open(whatsappUrl, '_blank');
  });
}