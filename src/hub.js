// The Fantasy Vault — Editorial Light Hub Script & Auth Integration
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const leagueNameInput = document.getElementById('input-league-name');
  const urlPreviewText = document.getElementById('url-preview-text');
  const registerForm = document.getElementById('register-demo-form');
  const registerModal = document.getElementById('register-modal');
  const closeRegisterModalBtn = document.getElementById('close-register-modal');
  const modalGeneratedUrl = document.getElementById('modal-generated-url');

  const headerJoinCodeForm = document.getElementById('header-join-code-form');
  const inputHeaderCode = document.getElementById('input-header-code');

  const btnHeaderSignin = document.getElementById('btn-header-signin');
  const authModal = document.getElementById('auth-modal');
  const closeAuthModalBtn = document.getElementById('close-auth-modal');
  const btnGoogleSSO = document.getElementById('btn-google-sso');
  const emailAuthForm = document.getElementById('email-auth-form');
  const btnForgotPassword = document.getElementById('btn-forgot-password');
  const headerAuthContainer = document.getElementById('header-auth-container');

  // Live UI Session Renderer
  function renderHeaderAuthUI() {
    if (!headerAuthContainer || typeof AuthEngine === 'undefined') return;
    const session = AuthEngine.getSession();

    if (session) {
      const persona = AuthEngine.getPersona();
      headerAuthContainer.innerHTML = `
        <div class="user-badge-header">
          <span style="white-space: nowrap; cursor: pointer; text-decoration: underline;" id="btn-header-navigate" title="Go to My League">${(session.name || session.email).split(' ')[0]}</span>
        </div>
        <button id="btn-header-logout" class="btn-header-signin" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;">Logout</button>
      `;

      const btnLogout = document.getElementById('btn-header-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          AuthEngine.logout();
        });
      }

      const btnNavigate = document.getElementById('btn-header-navigate');
      const accountModalElement = document.getElementById('account-modal');
      
      if (btnNavigate) {
        btnNavigate.addEventListener('click', () => {
          if (typeof window.renderAccountModal === 'function') {
            window.renderAccountModal();
          }
          if (accountModalElement && typeof accountModalElement.showModal === 'function') {
            accountModalElement.showModal();
          }
        });
      }
    } else {
      headerAuthContainer.innerHTML = `
        <button id="btn-header-signin" class="btn-header-signin">Sign In</button>
      `;
      const btnSignin = document.getElementById('btn-header-signin');
      if (btnSignin) {
        btnSignin.addEventListener('click', () => {
          if (authModal && typeof authModal.showModal === 'function') {
            authModal.showModal();
          }
        });
      }
    }
  }

  // Listen for Session changes
  window.addEventListener('vault_auth_changed', () => {
    renderHeaderAuthUI();
  });
  renderHeaderAuthUI();

  // Header 6-Character Join Code Processing
  if (headerJoinCodeForm && inputHeaderCode) {
    headerJoinCodeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = inputHeaderCode.value.trim().toUpperCase();
      if (!code) return;

      const session = AuthEngine.getSession();
      if (!session) {
        // User is not signed in; prompt them to sign in first
        window.pendingJoinCode = code;
        if (authModal && typeof authModal.showModal === 'function') {
          authModal.showModal();
        }
        return;
      }

      if (typeof window.startManagerClaimFlow === 'function') {
        window.startManagerClaimFlow(code, () => {
          const res = AuthEngine.processJoinCode(code);
          if (res.success) {
            window.location.href = res.league.path + `?join=${code}`;
          }
        });
      } else {
        const res = AuthEngine.processJoinCode(code);
        if (res.success) {
          alert(`Joining ${res.league.name}... Directing to league archive.`);
          window.location.href = res.league.path + `?join=${code}`;
        } else {
          alert(res.message);
        }
      }
    });
  }

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

  // Register Form Submit - Multi-Step Logic
  const stepAuth = document.getElementById('register-step-auth');
  const step1 = document.getElementById('register-step-1');
  const step2 = document.getElementById('register-step-2');
  const step3 = document.getElementById('register-step-3');
  const managerConfigList = document.getElementById('manager-config-list');
  const btnConfirmManagers = document.getElementById('btn-confirm-managers');
  const btnFinishRegister = document.getElementById('btn-finish-register');
  const btnAuthContinue = document.getElementById('btn-auth-continue');
  const modalInputAccess = document.getElementById('modal-input-access');
  const modalEspnPrivate = document.getElementById('modal-espn-private');
  const inputPlatform = document.getElementById('input-platform');
  const authPlatformName = document.getElementById('auth-platform-name');

  if (modalInputAccess && modalEspnPrivate && inputPlatform) {
    modalInputAccess.addEventListener('change', () => {
      const isEspn = inputPlatform.value === 'espn';
      const isPrivateOrUnsure = modalInputAccess.value === 'private' || modalInputAccess.value === 'unknown';
      modalEspnPrivate.style.display = (isEspn && isPrivateOrUnsure) ? 'block' : 'none';
    });
  }

  if (registerForm && registerModal) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
      const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';

      if (modalGeneratedUrl) {
        modalGeneratedUrl.textContent = `thefantasyvault.com/${slug}`;
      }

      // Reset to Auth Step
      if (stepAuth && step1 && step2 && step3) {
        stepAuth.style.display = 'block';
        step1.style.display = 'none';
        step2.style.display = 'none';
        step3.style.display = 'none';
        
        if (authPlatformName && inputPlatform) {
          authPlatformName.textContent = inputPlatform.value;
        }
        
        // Trigger the change event to ensure fields are correctly shown/hidden based on platform
        if (modalInputAccess) {
            modalInputAccess.dispatchEvent(new Event('change'));
        }
      }

      if (typeof registerModal.showModal === 'function') {
        registerModal.showModal();
      }
    });
  }

  if (btnAuthContinue) {
    btnAuthContinue.addEventListener('click', () => {
      if (stepAuth && step1) {
        stepAuth.style.display = 'none';
        step1.style.display = 'block';
      }

      // Simulate loading API / import (Step 1 -> Step 2)
      setTimeout(() => {
        if (step1 && step2) {
          step1.style.display = 'none';
          step2.style.display = 'block';
          
          if (managerConfigList) {
            const mockManagers = [
              { team: "Team Smith", handle: "smith_ff_pro", alias: "Smith" },
              { team: "Katz Dominators", handle: "landonekatz", alias: "Landon" },
              { team: "Watson Winners", handle: "mwatson88", alias: "Madoc" },
              { team: "Jordan's Juggernauts", handle: "jordan_jugg", alias: "Jordan" }
            ];
            
            managerConfigList.innerHTML = mockManagers.map((m, i) => `
              <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-alt); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-line);">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="checkbox" id="mgr-chk-${i}" checked>
                  <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${m.team}</div>
                    <div style="font-size: 0.75rem; color: var(--ink-muted);">Manager: @${m.handle}</div>
                  </div>
                </div>
                <div>
                  <input type="text" value="${m.alias}" class="form-input" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; width: 120px;" placeholder="Alias">
                </div>
              </div>
            `).join('');
          }
        }
      }, 1500);
    });
  }

  if (btnConfirmManagers) {
    btnConfirmManagers.addEventListener('click', () => {
      if (step2 && step3) {
        step2.style.display = 'none';
        step3.style.display = 'block';
      }
    });
  }

  if (btnFinishRegister) {
    btnFinishRegister.addEventListener('click', () => {
      if (registerModal) registerModal.close();
    });
  }

  if (closeRegisterModalBtn && registerModal) {
    closeRegisterModalBtn.addEventListener('click', () => {
      registerModal.close();
    });
  }

  // Auth Modal Handlers
  if (closeAuthModalBtn && authModal) {
    closeAuthModalBtn.addEventListener('click', () => {
      authModal.close();
    });
  }

  // Post-Login Redirect Handler
  function handlePostLogin(defaultMessage, defaultRedirect) {
    if (window.pendingJoinCode) {
      const code = window.pendingJoinCode;
      window.pendingJoinCode = null;
      if (typeof window.startManagerClaimFlow === 'function') {
        window.startManagerClaimFlow(code, () => {
          const res = AuthEngine.processJoinCode(code);
          if (res.success) {
            window.location.href = res.league.path + `?join=${code}`;
          }
        });
      } else {
        const res = AuthEngine.processJoinCode(code);
        if (res.success) {
          alert(`Joining ${res.league.name}... Directing to league archive.`);
          window.location.href = res.league.path + `?join=${code}`;
        } else {
          alert(res.message);
          if (defaultRedirect) window.location.href = defaultRedirect;
        }
      }
    } else {
      if (defaultMessage) alert(defaultMessage);
      if (defaultRedirect) window.location.href = defaultRedirect;
    }
  }

  // League Type Toggle Logic
  const inputLeagueType = document.getElementById('input-league-type');
  const groupPlatform = document.getElementById('group-platform');
  const groupPlatformsMultiple = document.getElementById('group-platforms-multiple');

  const groupEspnLeagueId = document.getElementById('group-espn-league-id');

  function updateEspnFields() {
    if (!inputPlatform || !groupEspnLeagueId) return;
    const isEspn = inputPlatform.value === 'espn' && inputLeagueType.value !== 'multiple-diff';
    groupEspnLeagueId.style.display = isEspn ? 'block' : 'none';
  }

  if (inputPlatform) {
    inputPlatform.addEventListener('change', updateEspnFields);
    if (inputLeagueType) inputLeagueType.addEventListener('change', updateEspnFields);
    updateEspnFields();
  }

  if (inputLeagueType && groupPlatform && groupPlatformsMultiple) {
    inputLeagueType.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'multiple-diff') {
        groupPlatform.style.display = 'none';
        groupPlatformsMultiple.style.display = 'block';
      } else {
        groupPlatform.style.display = 'block';
        groupPlatformsMultiple.style.display = 'none';
      }
      updateEspnFields();
    });
  }

  // Google SSO 1-Click
  if (btnGoogleSSO) {
    btnGoogleSSO.addEventListener('click', (e) => {
      e.preventDefault();
      AuthEngine.loginWithGoogle('manager@gmail.com');
      if (authModal) authModal.close();
      handlePostLogin('Signed in via Google SSO as manager@gmail.com.');
    });
  }

  // Email & Password Auth Form
  if (emailAuthForm) {
    emailAuthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('input-auth-email').value.trim();
      const pass = document.getElementById('input-auth-pass').value;

      AuthEngine.loginWithEmail(email, pass);
      if (authModal) authModal.close();
      handlePostLogin(`Signed in as ${email}. Session active.`);
    });
  }

  if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      const email = document.getElementById('input-auth-email').value.trim() || 'your email';
      alert(`Password recovery link has been dispatched to ${email}. Check your inbox to reset your password.`);
    });
  }
});
