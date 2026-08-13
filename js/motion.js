document.addEventListener('DOMContentLoaded', () => {
  // Draw signature line motifs when they enter view
  const motifs = document.querySelectorAll('.line-motif');
  const motifObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('drawn');
      }
    });
  }, { threshold: 0.3 });
  motifs.forEach(m => motifObserver.observe(m));

  // Fade/slide reveal for sections
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach(r => revealObserver.observe(r));
});