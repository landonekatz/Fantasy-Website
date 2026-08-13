// The Fantasy Vault — Editorial Light Hub Script & Auth Integration
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
        <div class="user-badge-header" style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="white-space: nowrap; font-weight: 600;" id="btn-header-navigate" title="Go to My Profile">${(session.name || session.email).split(' ')[0]}</span>
          <button id="btn-header-leagues" class="btn-header-signin" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; background: rgba(0,0,0,0.2); color: var(--text-main); border: 1px solid var(--border-line);">My Leagues</button>
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
      const btnLeagues = document.getElementById('btn-header-leagues');
      const accountModalElement = document.getElementById('account-modal');
      
      const openAccountModal = () => {
        if (typeof window.renderAccountModal === 'function') {
          window.renderAccountModal('profile');
        }
        if (accountModalElement && typeof accountModalElement.showModal === 'function' && !accountModalElement.open) {
          accountModalElement.showModal();
        }
      };

      if (btnNavigate) btnNavigate.addEventListener('click', openAccountModal);
      if (btnLeagues) btnLeagues.addEventListener('click', openAccountModal);
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
  const step4 = document.getElementById('register-step-4');
  const managerConfigList = document.getElementById('manager-config-list');
  const btnConfirmManagers = document.getElementById('btn-confirm-managers');
  const btnFinishRegister = document.getElementById('btn-finish-register');
  const btnAuthContinue = document.getElementById('btn-auth-continue');
  const modalInputAccess = document.getElementById('modal-input-access');
  const modalEspnPrivate = document.getElementById('modal-espn-private');
  const inputPlatform = document.getElementById('input-platform');
  const authPlatformName = document.getElementById('auth-platform-name');

  if (modalInputAccess) {
    modalInputAccess.addEventListener('change', () => {
      if (typeof updateEspnFields === 'function') updateEspnFields();
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
    btnAuthContinue.addEventListener('click', async () => {
      if (inputPlatform && inputPlatform.value !== 'espn') {
        const plat = inputPlatform.value.charAt(0).toUpperCase() + inputPlatform.value.slice(1);
        alert(`${plat} integration is coming soon!`);
        return;
      }

      const modalInputAccess = document.getElementById('modal-input-access');
      if (modalInputAccess && modalInputAccess.value === '') {
        alert("Please select whether your league is public or private.");
        return;
      }

      const leagueIdInput = document.getElementById('input-espn-id');
      const leagueId = leagueIdInput ? leagueIdInput.value.trim() : '';
      
      if (!leagueId) {
        alert("Please enter a valid ESPN League ID.");
        return;
      }

      const s2Input = document.getElementById('modal-espn-s2');
      const swidInput = document.getElementById('modal-espn-swid');
      const s2 = s2Input ? s2Input.value.trim() : '';
      const swid = swidInput ? swidInput.value.trim() : '';

      if (stepAuth && step1) {
        stepAuth.style.display = 'none';
        step1.style.display = 'block';
      }

      try {
        const url = `/api/espn?leagueId=${encodeURIComponent(leagueId)}&s2=${encodeURIComponent(s2)}&swid=${encodeURIComponent(swid)}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const errData = await res.json();
            if (errData.error) errMsg = errData.error;
          } catch(e) {}
          throw new Error(errMsg);
        }

        const data = await res.json();
        
        if (step1 && step2) {
          step1.style.display = 'none';
          step2.style.display = 'block';
          
          if (managerConfigList) {
            if (!data.members || data.members.length === 0) {
              managerConfigList.innerHTML = '<div style="padding: 1rem; color: #ff6b6b; text-align: center;">No managers found in this league. Please check your League ID.</div>';
              return;
            }

            const activeHtml = [];
            const inactiveHtml = [];

            data.members.forEach((m, i) => {
              const handle = m.displayName || 'unknown';
              let alias = m.firstName || m.lastName || handle;
              if (m.firstName && m.lastName) {
                  alias = `${m.firstName} ${m.lastName.charAt(0)}.`;
              }
              
              const itemHtml = `
              <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-alt); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-line); opacity: ${m.isActive ? '1' : '0.6'};">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="checkbox" id="mgr-chk-${i}" ${m.isActive ? 'checked' : ''}>
                  <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${m.isActive ? 'Active' : `Last Seen: ${m.lastSeenYear}`}</div>
                    <div style="font-size: 0.75rem; color: var(--ink-muted);">Manager: @${handle}</div>
                  </div>
                </div>
                <div>
                  <input type="text" value="${alias}" class="form-input" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; width: 120px;" placeholder="Alias">
                </div>
              </div>
              `;

              if (m.isActive) activeHtml.push(itemHtml);
              else inactiveHtml.push(itemHtml);
            });

            managerConfigList.innerHTML = `
              <div style="font-size: 0.85rem; color: var(--accent-gold); font-weight: 600; margin-bottom: 0.25rem;">Active Managers (${data.activeSeason})</div>
              ${activeHtml.join('')}
              ${inactiveHtml.length > 0 ? `<div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem;">Historical Managers (Inactive)</div>${inactiveHtml.join('')}` : ''}
            `;
          }
        }
      } catch (err) {
        alert("Failed to fetch league data: " + err.message);
        if (step1 && stepAuth) {
          step1.style.display = 'none';
          stepAuth.style.display = 'block';
        }
      }
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

  const btnRegisterGoogle = document.getElementById('btn-register-google');
  const btnRegisterEmail = document.getElementById('btn-register-email');

  const advanceToStep4 = () => {
    if (step3 && step4) {
      step3.style.display = 'none';
      step4.style.display = 'block';
    }
  };

  if (btnRegisterGoogle) {
    btnRegisterGoogle.addEventListener('click', () => {
      AuthEngine.loginWithGoogle('admin@gmail.com');
      advanceToStep4();
    });
  }

  if (btnRegisterEmail) {
    btnRegisterEmail.addEventListener('click', () => {
      const email = document.getElementById('register-email');
      if (email && email.value) {
        AuthEngine.loginWithEmail(email.value, 'password');
        advanceToStep4();
      } else {
        alert("Please enter an email");
      }
    });
  }

  if (btnFinishRegister) {
    btnFinishRegister.addEventListener('click', () => {
      if (registerModal) registerModal.close();
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
      const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';
      window.location.href = '/' + slug;
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
    const isEspn = inputPlatform.value === 'espn' && (!inputLeagueType || inputLeagueType.value !== 'multiple-diff');
    
    // Only show League ID input if they have selected a privacy option
    const modalInputAccess = document.getElementById('modal-input-access');
    const privacySelected = modalInputAccess ? (modalInputAccess.value !== '') : true;
    groupEspnLeagueId.style.display = (isEspn && privacySelected) ? 'block' : 'none';

    // Show s2/swid if private or unknown
    const modalEspnPrivate = document.getElementById('modal-espn-private');
    if (modalEspnPrivate && modalInputAccess) {
      const isPrivateOrUnsure = modalInputAccess.value === 'private' || modalInputAccess.value === 'unknown';
      modalEspnPrivate.style.display = (isEspn && privacySelected && isPrivateOrUnsure) ? 'block' : 'none';
    }
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

