// The Fantasy Vault — Editorial Light Hub Script
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const leagueNameInput = document.getElementById('input-league-name');
  const urlPreviewText = document.getElementById('url-preview-text');
  const registerForm = document.getElementById('register-demo-form');
  const registerModal = document.getElementById('register-modal');
  const closeRegisterModalBtn = document.getElementById('close-register-modal');
  const modalGeneratedUrl = document.getElementById('modal-generated-url');

  const btnFindLeague = document.getElementById('btn-find-league');
  const findModal = document.getElementById('find-modal');
  const closeFindModalBtn = document.getElementById('close-find-modal');
  const leagueSearchInput = document.getElementById('input-league-search');
  const searchResultsList = document.getElementById('search-results-list');

  const btnOpenFounderModal = document.getElementById('btn-open-founder-modal');
  const founderModal = document.getElementById('founder-modal');
  const closeFounderModalBtn = document.getElementById('close-founder-modal');
  const founderLoginForm = document.getElementById('founder-login-form');

  // Live URL Preview matching input exactly
  if (leagueNameInput && urlPreviewText) {
    const updateUrlPreview = () => {
      const raw = leagueNameInput.value.trim();
      if (!raw) {
        urlPreviewText.textContent = 'thefantasyvault.com/ironcladdynastyleague';
        return;
      }
      const slug = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      urlPreviewText.textContent = `thefantasyvault.com/${slug || 'ironcladdynastyleague'}`;
    };

    leagueNameInput.addEventListener('input', updateUrlPreview);
  }

  // Register Form Submit
  if (registerForm && registerModal) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
      const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';

      if (modalGeneratedUrl) {
        modalGeneratedUrl.textContent = `thefantasyvault.com/${slug}`;
      }

      if (typeof registerModal.showModal === 'function') {
        registerModal.showModal();
      }
    });
  }

  if (closeRegisterModalBtn && registerModal) {
    closeRegisterModalBtn.addEventListener('click', () => {
      registerModal.close();
    });
  }

  // Find Your League Modal Handler
  if (btnFindLeague && findModal) {
    btnFindLeague.addEventListener('click', () => {
      if (typeof findModal.showModal === 'function') {
        findModal.showModal();
      }
    });
  }

  if (closeFindModalBtn && findModal) {
    closeFindModalBtn.addEventListener('click', () => {
      findModal.close();
    });
  }

  // Founder Console Modal Handler
  if (btnOpenFounderModal && founderModal) {
    btnOpenFounderModal.addEventListener('click', () => {
      if (findModal && typeof findModal.close === 'function') {
        findModal.close();
      }
      if (typeof founderModal.showModal === 'function') {
        founderModal.showModal();
      }
    });
  }

  if (closeFounderModalBtn && founderModal) {
    closeFounderModalBtn.addEventListener('click', () => {
      founderModal.close();
    });
  }

  if (founderLoginForm) {
    founderLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = document.getElementById('input-founder-pass').value;
      if (pass) {
        alert('Welcome back, Landon! Platform Admin Console authenticated.');
        window.location.href = '/dmsfantasy/';
      }
    });
  }

  // League Lookup Search Form
  const leagueLookupForm = document.getElementById('league-lookup-form');
  if (leagueLookupForm && leagueSearchInput) {
    leagueLookupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = leagueSearchInput.value.toLowerCase().trim();
      if (!query) return;

      const cleanQuery = query.replace(/[^a-z0-9]/g, '');

      if (cleanQuery.includes('dumbarton') || cleanQuery.includes('dms')) {
        window.location.href = '/dmsfantasy/';
      } else if (cleanQuery.includes('gaywood') || cleanQuery.includes('katz') || cleanQuery.includes('dad')) {
        window.location.href = '/gaywoodfantasy/';
      } else {
        searchResultsList.innerHTML = `
          <div style="background: var(--bg-card-alt); border: 1px solid var(--border-line); border-radius: 6px; padding: 1rem; margin-top: 0.5rem;">
            <p style="font-size: 0.9rem; color: var(--ink-primary); margin-bottom: 0.25rem;"><strong>Searching for "${query}"</strong></p>
            <p style="font-size: 0.85rem; color: var(--ink-muted);">If this is a private league, use the direct invite link or Join Code provided by your League Admin to access your archive.</p>
          </div>
        `;
      }
    });
  }
});
