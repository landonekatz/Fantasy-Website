// The Fantasy Vault — Editorial Hub Script
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const leagueNameInput = document.getElementById('input-league-name');
  const urlPreviewText = document.getElementById('url-preview-text');
  const registerForm = document.getElementById('register-demo-form');
  const registerModal = document.getElementById('register-modal');
  const closeRegisterModalBtn = document.getElementById('close-register-modal');
  const modalGeneratedUrl = document.getElementById('modal-generated-url');

  const btnMemberLogin = document.getElementById('btn-member-login');
  const joinModal = document.getElementById('join-modal');
  const closeJoinModalBtn = document.getElementById('close-join-modal');
  const joinForm = document.getElementById('join-form');

  // Live URL Preview matching input exactly
  if (leagueNameInput && urlPreviewText) {
    const updateUrlPreview = () => {
      const raw = leagueNameInput.value.trim();
      if (!raw) {
        urlPreviewText.textContent = 'thefantasyvault.com/[your-league-name]';
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

  // Member Login / Join Modal Handler
  if (btnMemberLogin && joinModal) {
    btnMemberLogin.addEventListener('click', () => {
      if (typeof joinModal.showModal === 'function') {
        joinModal.showModal();
      }
    });
  }

  if (closeJoinModalBtn && joinModal) {
    closeJoinModalBtn.addEventListener('click', () => {
      joinModal.close();
    });
  }

  if (joinForm) {
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const joinInput = document.getElementById('input-join-code').value.trim();
      if (!joinInput) return;

      const cleanTarget = joinInput.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (cleanTarget.includes('dumbarton') || cleanTarget.includes('dms')) {
        window.location.href = '/dmsfantasy/';
      } else if (cleanTarget.includes('gaywood') || cleanTarget.includes('katz') || cleanTarget.includes('dad')) {
        window.location.href = '/gaywoodfantasy/';
      } else {
        alert(`Searching for league "${joinInput}"... Direct invite links automatically sign you into your private league portal.`);
      }
    });
  }
});
