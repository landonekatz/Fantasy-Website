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

  // Live URL Preview matching input exactly
  if (leagueNameInput && urlPreviewText) {
    const updateUrlPreview = () => {
      const raw = leagueNameInput.value.trim();
      if (!raw) {
        urlPreviewText.textContent = 'thefantasyvault.com/ironcladdynastyleague';
        return;
      }
      const slug = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      urlPreviewText.textContent = `thefantasyvault.com/${slug || 'yourleaguename'}`;
    };

    leagueNameInput.addEventListener('input', updateUrlPreview);
  }

  // Register Form Submit
  if (registerForm && registerModal) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
      const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'yourleaguename';

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

  // Filter Active Leagues in Finder Modal
  if (leagueSearchInput && searchResultsList) {
    const defaultHTML = searchResultsList.innerHTML;

    leagueSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        searchResultsList.innerHTML = defaultHTML;
        return;
      }

      const items = searchResultsList.querySelectorAll('.league-search-result');
      let count = 0;
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = 'flex';
          count++;
        } else {
          item.style.display = 'none';
        }
      });

      if (count === 0) {
        const noMatchMsg = document.getElementById('no-match-msg');
        if (!noMatchMsg) {
          const p = document.createElement('p');
          p.id = 'no-match-msg';
          p.style.color = 'var(--ink-muted)';
          p.style.fontSize = '0.9rem';
          p.style.marginTop = '0.5rem';
          p.textContent = `No active league found for "${query}". Direct invite links grant immediate access to private league archives.`;
          searchResultsList.appendChild(p);
        }
      } else {
        const noMatchMsg = document.getElementById('no-match-msg');
        if (noMatchMsg) noMatchMsg.remove();
      }
    });
  }
});
