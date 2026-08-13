let currentLeagueCreds = null;
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
      currentLeagueCreds = { leagueId, s2, swid };

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
        if (currentLeagueCreds) {
          currentLeagueCreds.members = data.members;
        }
        
        if (step1 && step2) {
          step1.style.display = 'none';
          step2.style.display = 'block';
          
          if (managerConfigList) {
            if (!data.members || data.members.length === 0) {
              managerConfigList.innerHTML = '<div style="padding: 1rem; color: #ff6b6b; text-align: center;">No managers found in this league. Please check your League ID.</div>';
              return;
            }
            // Pre-populate aliases so they can be edited and stored
            data.members.forEach(m => {
                if (m.alias === undefined) {
                    const handle = m.displayName || 'unknown';
                    m.alias = m.firstName || m.lastName || handle;
                    if (m.firstName && m.lastName) {
                        m.alias = `${m.firstName} ${m.lastName.charAt(0)}.`;
                    }
                }
            });

            // Auto-demote and auto-merge duplicate active managers
            const normalizeString = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const activeSeen = new Map();
            data.members.forEach(m => {
                if (m.isActive) {
                    const norm = normalizeString(m.alias);
                    if (activeSeen.has(norm)) {
                        m.isActive = false;
                        m.mergedInto = activeSeen.get(norm);
                    } else {
                        activeSeen.set(norm, m.id);
                    }
                }
            });

            const renderManagerList = () => {
              const activeHtml = [];
              const inactiveHtml = [];
              const activeManagers = data.members.filter(m => m.isActive);
              
              const normalizeString = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              
              const getActiveOptions = (inactiveMember) => {
                let options = '<option value="">Keep Separate</option>';
                let matchedId = null;
                activeManagers.forEach(active => {
                  const activeHandle = active.displayName || 'unknown';
                  const activeAlias = active.alias;
                  
                  const isMatch = (
                    normalizeString(inactiveMember.alias) === normalizeString(activeAlias) || 
                    (inactiveMember.displayName && inactiveMember.displayName !== 'unknown' && inactiveMember.displayName === activeHandle)
                  );
                  if (isMatch) matchedId = active.id;
                  
                  options += `<option value="${active.id}" ${isMatch ? 'selected' : ''}>Merge into: ${activeAlias}</option>`;
                });
                if (matchedId && !inactiveMember.mergedInto) {
                   inactiveMember.mergedInto = matchedId;
                }
                return options;
              };

              data.members.forEach((m, i) => {
                const handle = m.displayName || 'unknown';
                const alias = m.alias;
                
                if (m.isActive) {
                  const duplicateActive = activeManagers.filter(am => {
                    const amHandle = am.displayName || 'unknown';
                    const amAlias = am.alias;
                    
                    const isAliasMatch = normalizeString(amAlias) === normalizeString(alias);
                    const isHandleMatch = amHandle !== 'unknown' && amHandle === handle;
                    
                    return (isAliasMatch || isHandleMatch) && am.id !== m.id;
                  });

                  const mergeBtnHtml = duplicateActive.length > 0 ? `
                    <button type="button" class="btn-merge-active" data-index="${i}" style="background: var(--accent-gold); color: black; border: none; padding: 0.35rem 0.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; margin-left: 0.5rem;">Merge Now</button>
                  ` : '';

                  activeHtml.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-alt); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-line);">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input type="checkbox" class="mgr-chk" data-index="${i}" checked>
                        <div>
                          <div style="font-weight: 600; font-size: 0.9rem;">Active</div>
                          <div style="font-size: 0.75rem; color: var(--ink-muted);">Manager: @${handle}</div>
                        </div>
                      </div>
                      <div style="display: flex; align-items: center;">
                        <input type="text" value="${alias}" class="form-input mgr-alias" data-index="${i}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; width: 120px;" placeholder="Alias">
                        ${mergeBtnHtml}
                      </div>
                    </div>
                  `);
                } else {
                  inactiveHtml.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-alt); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-line); opacity: 0.85;">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input type="checkbox" class="mgr-chk" data-index="${i}">
                        <div>
                          <div style="font-weight: 600; font-size: 0.9rem;">Last Seen: ${m.lastSeenYear || 'Unknown'}</div>
                          <div style="font-size: 0.75rem; color: var(--ink-muted);">Manager: @${handle}</div>
                        </div>
                      </div>
                      <div style="display: flex; gap: 0.5rem;">
                        <select class="form-input mgr-merge-select" data-index="${i}" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; width: 140px;">
                          ${getActiveOptions(m)}
                        </select>
                        <input type="text" value="${alias}" class="form-input mgr-alias" data-index="${i}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; width: 120px;" placeholder="Alias">
                      </div>
                    </div>
                  `);
                }
              });

              const activeDuplicates = [];
              const seenNorms = new Set();
              activeManagers.forEach(am => {
                  const amHandle = am.displayName || 'unknown';
                  let amAlias = am.firstName || am.lastName || amHandle;
                  if (am.firstName && am.lastName) {
                      amAlias = `${am.firstName} ${am.lastName.charAt(0)}.`;
                  }
                  const norm = normalizeString(amAlias);
                  if (seenNorms.has(norm)) {
                      activeDuplicates.push(amAlias);
                  } else {
                      seenNorms.add(norm);
                  }
              });
              
              let duplicateWarningHtml = '';
              if (activeDuplicates.length > 0) {
                  const dupNames = [...new Set(activeDuplicates)].join(', ');
                  duplicateWarningHtml = `
                    <div style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid var(--accent-gold); padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
                      <div style="color: var(--accent-gold); font-weight: bold; margin-bottom: 0.25rem;">Duplicate Active Managers Detected</div>
                      <div style="font-size: 0.85rem; color: var(--text-main);">We pulled in multiple active profiles for: <strong>${dupNames}</strong>. Click "Merge Now" next to their names below to combine their history. (You can also merge managers later in the Admin Dashboard).</div>
                    </div>
                  `;
              }

              let autoMergedNames = [];
              data.members.forEach(m => {
                  if (!m.isActive && m.mergedInto) {
                      autoMergedNames.push(m.alias || m.displayName);
                  }
              });

              let inactiveMergedWarningHtml = '';
              if (autoMergedNames.length > 0) {
                  inactiveMergedWarningHtml = `
                    <div style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid var(--accent-gold); padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
                      <div style="color: var(--accent-gold); font-weight: bold; margin-bottom: 0.25rem;">Historical Managers Auto-Merged</div>
                      <div style="font-size: 0.85rem; color: var(--text-main);">We found historical profiles matching active managers (<strong>${[...new Set(autoMergedNames)].join(', ')}</strong>) and automatically merged them. Check the "Historical Managers" list below to review and change the dropdown to "Keep Separate" if you wish to unmerge them.</div>
                    </div>
                  `;
              }

              managerConfigList.innerHTML = `
                ${duplicateWarningHtml}
                ${inactiveMergedWarningHtml}
                <div style="font-size: 0.85rem; color: var(--accent-gold); font-weight: 600; margin-bottom: 0.25rem;">Active Managers (${data.activeSeason} Season)</div>
                ${activeHtml.join('')}
                ${inactiveHtml.length > 0 ? `<div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem;">Historical Managers (Inactive)</div>${inactiveHtml.join('')}` : ''}
              `;

              // Attach event listeners to checkboxes
              document.querySelectorAll('.mgr-chk').forEach(chk => {
                chk.addEventListener('change', (e) => {
                  const idx = parseInt(e.target.getAttribute('data-index'));
                  data.members[idx].isActive = e.target.checked;
                  renderManagerList(); // Re-render the UI
                });
              });

              // Attach event listeners to Alias inputs to enable dynamic renaming
              document.querySelectorAll('.mgr-alias').forEach(input => {
                input.addEventListener('change', (e) => {
                  const idx = parseInt(e.target.getAttribute('data-index'));
                  const newAlias = e.target.value.trim();
                  if (newAlias) {
                    data.members[idx].alias = newAlias;
                    renderManagerList();
                  }
                });
              });

              // Attach event listeners to Merge selects
              document.querySelectorAll('.mgr-merge-select').forEach(select => {
                select.addEventListener('change', (e) => {
                  const idx = parseInt(e.target.getAttribute('data-index'));
                  data.members[idx].mergedInto = e.target.value;
                });
              });

              // Attach event listeners to Merge Now buttons
              document.querySelectorAll('.btn-merge-active').forEach(btn => {
                btn.addEventListener('click', (e) => {
                  const idx = parseInt(e.target.getAttribute('data-index'));
                  data.members[idx].isActive = false; // Move to historical
                  renderManagerList(); // Will auto-select the merge target
                });
              });
            };

            renderManagerList();
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

  const advanceToStep4 = async (slug) => {
    // Check if the league name already exists
    try {
        const checkRes = await fetch(`https://fantasy-vault-4f8da-default-rtdb.firebaseio.com/leagues/${slug}.json?shallow=true`);
        const existsData = await checkRes.json();
        if (existsData !== null) {
            alert(`This league name already exists and you can't use it. Please choose a different name.`);
            
            // Go back to step auth
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'none';
            if (step3) step3.style.display = 'none';
            if (stepAuth) stepAuth.style.display = 'block';
            return;
        }
    } catch (e) {
        console.error("Duplicate check failed:", e);
    }

    if (currentLeagueCreds) {
      sessionStorage.setItem('pendingVaultBuild', JSON.stringify(currentLeagueCreds));
    }
    // Immediately redirect to the new league page with the building flag
    window.location.href = '/' + slug + '?building=true';
  };

  const triggerWelcomeEmail = async (email, slug) => {
    try {
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, slug })
      });
    } catch (e) {
      console.error("Failed to send welcome email", e);
    }
  };

  if (btnRegisterGoogle) {
    btnRegisterGoogle.addEventListener('click', async () => {
      try {
        const user = await AuthEngine.loginWithGoogle();
        const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
        const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';
        
        advanceToStep4(slug);
      } catch (err) {
        alert("Google Sign-In failed: " + err.message);
      }
    });
  }

  if (btnRegisterEmail) {
    btnRegisterEmail.addEventListener('click', async () => {
      const email = document.getElementById('register-email');
      const password = document.getElementById('register-password');
      if (email && email.value && password && password.value) {
        try {
          const user = await AuthEngine.loginWithEmail(email.value, password.value);
          const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
          const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';
          
          advanceToStep4(slug);
        } catch (err) {
          alert("Sign In failed: " + err.message);
        }
      } else {
        alert("Please enter both email and password");
      }
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

  // Join Code Flow
  const btnVerifyJoinCode = document.getElementById('btn-verify-join-code');
  const inputJoinCode = document.getElementById('input-join-code');
  const profileSelectWrapper = document.getElementById('join-profile-select-wrapper');
  const selectJoinProfile = document.getElementById('select-join-profile');
  
  if (btnVerifyJoinCode && inputJoinCode) {
    btnVerifyJoinCode.addEventListener('click', () => {
      const code = inputJoinCode.value.trim().toUpperCase();
      if (!code) {
        alert("Please enter a join code");
        return;
      }
      
      const result = AuthEngine.processJoinCode(code);
      if (result.success) {
        // Populate manager dropdown
        if (selectJoinProfile) {
          selectJoinProfile.innerHTML = '<option value="" disabled selected>Select your profile...</option>';
          result.league.managers.forEach(mgr => {
            selectJoinProfile.innerHTML += `<option value="${mgr.id}">${mgr.name}</option>`;
          });
        }
        if (profileSelectWrapper) profileSelectWrapper.style.display = 'block';
        window.pendingJoinCode = code; // save it to complete after auth
      } else {
        alert(result.message);
      }
    });
  }

  // Post-Login Redirect Handler
  async function handlePostLogin(defaultMessage, defaultRedirect) {
    if (window.pendingJoinCode && selectJoinProfile && selectJoinProfile.value) {
      const code = window.pendingJoinCode;
      const managerId = selectJoinProfile.value;
      
      window.pendingJoinCode = null;
      
      const res = await AuthEngine.finalizeJoin(code, managerId);
      if (res.success) {
        alert(`Successfully joined ${res.league.name}! Directing to league archive.`);
        window.location.href = res.league.path;
      } else {
        alert(res.message);
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
    btnGoogleSSO.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const user = await AuthEngine.loginWithGoogle();
        if (authModal) authModal.close();
        await handlePostLogin(`Signed in via Google SSO as ${user.email}.`);
      } catch (err) {
        alert("Google Sign-In failed: " + err.message);
      }
    });
  }

  // Email & Password Auth Form
  if (emailAuthForm) {
    emailAuthForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('input-auth-email').value.trim();
      const pass = document.getElementById('input-auth-pass').value;

      try {
        const user = await AuthEngine.loginWithEmail(email, pass);
        if (authModal) authModal.close();
        await handlePostLogin(`Signed in as ${user.email}. Session active.`);
      } catch (err) {
        alert("Sign In failed: " + err.message);
      }
    });
  }

  if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      const email = document.getElementById('input-auth-email').value.trim() || 'your email';
      alert(`Password recovery link has been dispatched to ${email}. Check your inbox to reset your password.`);
    });
  }

  // Handle ?join=CODE URL Parameter
  const urlParams = new URLSearchParams(window.location.search);
  const joinParam = urlParams.get('join');
  if (joinParam) {
    if (authModal && typeof authModal.showModal === 'function') {
      authModal.showModal();
      if (inputJoinCode) {
        inputJoinCode.value = joinParam;
        if (btnVerifyJoinCode) {
          btnVerifyJoinCode.click();
        }
      }
    }
  }
