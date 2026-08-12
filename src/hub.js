// The Fantasy Ledger - Landing Hub Interactive Logic
document.addEventListener('DOMContentLoaded', () => {
  const leagueNameInput = document.getElementById('input-league-name');
  const slugPreview = document.getElementById('slug-preview-text');
  const registerForm = document.getElementById('register-demo-form');
  const registerModal = document.getElementById('register-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const generatedSlugSpan = document.getElementById('modal-generated-slug');

  if (leagueNameInput && slugPreview) {
    leagueNameInput.addEventListener('input', (e) => {
      const name = e.target.value.trim();
      if (!name) {
        slugPreview.textContent = 'thefantasyledger.com/[your-league-slug]';
        return;
      }
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30);
      slugPreview.textContent = `thefantasyledger.com/${slug || 'yourleague'}`;
    });
  }

  if (registerForm && registerModal) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : '';
      const slug = rawName
        ? rawName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
        : 'newleague';
      
      if (generatedSlugSpan) {
        generatedSlugSpan.textContent = `thefantasyledger.com/${slug}`;
      }
      
      if (typeof registerModal.showModal === 'function') {
        registerModal.showModal();
      } else {
        alert(`League "${rawName}" registered! Your custom URL will be: thefantasyledger.com/${slug}`);
      }
    });
  }

  if (closeModalBtn && registerModal) {
    closeModalBtn.addEventListener('click', () => {
      registerModal.close();
    });
  }
});
