import { database } from './firebase.js';
import { ref as dbRef, get } from 'firebase/database';

let currentLeagueCreds = null;
// The Fantasy Vault - Editorial Light Hub Script & Auth Integration
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
      const isFounder = Boolean(session.isFounder || (session.email && session.email.toLowerCase() === 'landonekatz@gmail.com'));
      headerAuthContainer.innerHTML = `
        <div class="user-badge-header" style="display: flex; align-items: center; gap: 0.75rem;">
          ${isFounder ? `
            <div id="hub-founder-switcher" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.45); border-radius: 9999px; padding: 2px 8px 2px 10px;">
              <span style="font-size: 0.72rem; font-weight: 800; color: var(--accent-gold, #b45309); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">Founder:</span>
              <select id="hub-founder-select" style="background: transparent; border: none; color: var(--text-main); font-size: 0.78rem; font-weight: 600; cursor: pointer; outline: none; max-width: 170px;">
                <option value="" disabled selected>Switch League...</option>
              </select>
            </div>
          ` : ''}
          <span style="white-space: nowrap; font-weight: 600; cursor: pointer;" id="btn-header-navigate" title="Go to My Profile">${(() => { const n = (session.name || session.email || 'User').split(' ')[0].split('@')[0]; return n.charAt(0).toUpperCase() + n.slice(1); })()}</span>
          <button id="btn-header-leagues" class="btn-header-signin" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; background: rgba(0,0,0,0.2); color: var(--text-main); border: 1px solid var(--border-line);">My Leagues</button>
        </div>
        <button id="btn-header-logout" class="btn-header-signin" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;">Logout</button>
      `;

      if (isFounder) {
        const hubSelect = document.getElementById('hub-founder-select');
        if (hubSelect) {
          const populate = (leagues) => {
            if (!leagues || leagues.length === 0) return;
            let html = '<option value="" disabled selected>Switch League...</option>';
            leagues.forEach(l => {
              const lSlug = (l.slug || '').toLowerCase().trim();
              const path = (typeof AuthEngine?.resolveLeaguePath === 'function') 
                ? AuthEngine.resolveLeaguePath(lSlug) 
                : (l.path || `/${lSlug}`);
              html += `<option value="${path}">${l.name} (${(l.platform || 'espn').toUpperCase()})${l.isPrivate ? ' [Private]' : ''}</option>`;
            });
            hubSelect.innerHTML = html;
            hubSelect.onchange = function() {
              if (this.value) {
                try {
                  sessionStorage.setItem('vault_founder_nav_toggle', 'true');
                  sessionStorage.setItem('vault_founder_mode_active', 'true');
                } catch (e) {}
                window.location.href = this.value;
              }
            };
          };
          if (session.allLeagues && session.allLeagues.length > 0) {
            populate(session.allLeagues);
          }
          if (typeof AuthEngine.fetchAllVaultLeagues === 'function') {
            AuthEngine.fetchAllVaultLeagues().then(leagues => {
              session.allLeagues = leagues;
              populate(leagues);
            });
          }
        }
      }

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
    headerJoinCodeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = inputHeaderCode.value.trim().toUpperCase();
      if (!code) return;

      if (typeof window.startManagerClaimFlow === 'function') {
        window.startManagerClaimFlow(code);
      } else {
        const res = await AuthEngine.resolveJoinCode(code);
        if (res.success) {
          window.location.href = res.league.path;
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
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
      const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';

      // Duplicate League Check EARLY
      try {
          // Disable button while checking
          const submitBtn = registerForm.querySelector('button[type="submit"]');
          const originalText = submitBtn ? submitBtn.textContent : '';
          if (submitBtn) submitBtn.textContent = 'Checking...';
          
          const checkRes = await fetch(`https://fantasy-vault-4f8da-default-rtdb.firebaseio.com/leagues/${slug}.json?shallow=true`);
          const existsData = await checkRes.json();
          
          if (submitBtn) submitBtn.textContent = originalText;

          if (existsData !== null) {
              alert(`The league name "${rawName}" (URL: /${slug}) already exists in our system. Please choose a different name so you don't overwrite an existing league!`);
              return; // Stop the signup flow completely
          }
      } catch (err) {
          console.error("Failed to check duplicate league name", err);
      }

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
      const platform = inputPlatform ? inputPlatform.value : 'espn';

      if (platform === 'yahoo') {
        const yahooLeagueIdInput = document.getElementById('input-yahoo-id');
        const yLeagueId = yahooLeagueIdInput ? yahooLeagueIdInput.value.trim() : '';
        if (!yLeagueId) {
          // Trigger the 1-click OAuth flow
          const btnOauth = document.getElementById('btn-yahoo-oauth');
          if (btnOauth) btnOauth.click();
          return;
        }

        const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'Yahoo League';
        currentLeagueCreds = { platform: 'yahoo', leagueId: yLeagueId, customName: rawName };

        if (stepAuth && step1) {
          stepAuth.style.display = 'none';
          step1.style.display = 'block';
        }

        try {
          const res = await fetch(`/api/scrape-yahoo-season?league_key=${encodeURIComponent(yLeagueId)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (currentLeagueCreds) {
            currentLeagueCreds.members = data.members;
          }
          if (step1 && step2) {
            step1.style.display = 'none';
            step2.style.display = 'block';
          }
        } catch (err) {
          alert('Failed to fetch Yahoo league: ' + err.message);
          if (step1 && stepAuth) {
            step1.style.display = 'none';
            stepAuth.style.display = 'block';
          }
        }
        return;
      }

      if (platform !== 'espn') {
        const plat = platform.charAt(0).toUpperCase() + platform.slice(1);
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
      const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
      currentLeagueCreds = { platform, leagueId, s2, swid, customName: rawName };

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
              
              const getMergeOptions = (targetMember) => {
                let options = '<option value="">Keep Separate</option>';
                let matchedId = null;

                const otherActive = data.members.filter(m => m.isActive && m.id !== targetMember.id);
                if (otherActive.length > 0) {
                  options += '<optgroup label="Active Managers">';
                  otherActive.forEach(active => {
                    const activeHandle = active.displayName || 'unknown';
                    const activeAlias = active.alias;
                    const isMatch = (
                      normalizeString(targetMember.alias) === normalizeString(activeAlias) || 
                      (targetMember.displayName && targetMember.displayName !== 'unknown' && targetMember.displayName === activeHandle)
                    );
                    if (isMatch) matchedId = active.id;
                    const isSelected = targetMember.mergedInto === active.id;
                    options += `<option value="${active.id}" ${isSelected ? 'selected' : ''}>Merge into: ${activeAlias}</option>`;
                  });
                  options += '</optgroup>';
                }

                const otherInactive = data.members.filter(m => !m.isActive && m.id !== targetMember.id);
                if (otherInactive.length > 0) {
                  options += '<optgroup label="Historical / Inactive Managers">';
                  otherInactive.forEach(inactive => {
                    const isSelected = targetMember.mergedInto === inactive.id;
                    options += `<option value="${inactive.id}" ${isSelected ? 'selected' : ''}>Merge into: ${inactive.alias}</option>`;
                  });
                  options += '</optgroup>';
                }

                if (matchedId && !targetMember.mergedInto) {
                   targetMember.mergedInto = matchedId;
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
                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-alt); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-line); margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input type="checkbox" class="mgr-chk" data-index="${i}" checked>
                        <div>
                          <div style="font-weight: 600; font-size: 0.9rem;">Active</div>
                          <div style="font-size: 0.75rem; color: var(--ink-muted);">Manager: @${handle}</div>
                        </div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <select class="form-input mgr-merge-select" data-index="${i}" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; width: 140px;">
                          ${getMergeOptions(m)}
                        </select>
                        <input type="text" value="${alias}" class="form-input mgr-alias" data-index="${i}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; width: 120px;" placeholder="Alias">
                        ${mergeBtnHtml}
                      </div>
                    </div>
                  `);
                } else {
                  inactiveHtml.push(`
                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-alt); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-line); opacity: 0.85; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input type="checkbox" class="mgr-chk" data-index="${i}">
                        <div>
                          <div style="font-weight: 600; font-size: 0.9rem;">Last Seen: ${m.lastSeenYear || 'Unknown'}</div>
                          <div style="font-size: 0.75rem; color: var(--ink-muted);">Manager: @${handle}</div>
                        </div>
                      </div>
                      <div style="display: flex; gap: 0.5rem;">
                        <select class="form-input mgr-merge-select" data-index="${i}" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; width: 140px;">
                          ${getMergeOptions(m)}
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
                  const val = e.target.value;
                  data.members[idx].mergedInto = val;
                  if (val) {
                    data.members[idx].isActive = false;
                    renderManagerList();
                  }
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
      const session = AuthEngine ? AuthEngine.getSession() : null;
      if (step2 && step3) {
        step2.style.display = 'none';
        step3.style.display = 'block';

        if (session && session.email) {
          step3.innerHTML = `
            <div style="text-align: center; padding: 1rem 0;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #dcfce7; color: #15803d; font-weight: 800; font-size: 1.1rem; margin-bottom: 12px;">✓</div>
              <h3 class="modal-title" style="margin-bottom: 0.35rem;">Authenticated Account Active</h3>
              <p class="modal-text" style="margin-bottom: 1.5rem; font-size: 0.92rem;">
                You are signed in as <strong>${session.email}</strong>. This new league vault will be linked to your administrator profile immediately.
              </p>
              <button id="btn-build-now" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.85rem; font-size: 1rem; font-weight: 700; cursor: pointer;">
                Build League Vault &rarr;
              </button>
            </div>
          `;
          document.getElementById('btn-build-now')?.addEventListener('click', () => {
            const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
            const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';
            advanceToStep4(slug);
          });
        }
      }
    });
  }

  const btnRegisterGoogle = document.getElementById('btn-register-google');
  const btnRegisterEmail = document.getElementById('btn-register-email');

  const advanceToStep4 = async (slug) => {
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
          const user = await AuthEngine.registerWithEmail(email.value, password.value);
          const rawName = leagueNameInput ? leagueNameInput.value.trim() : 'League';
          const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ironcladdynastyleague';
          
          advanceToStep4(slug);
        } catch (err) {
          alert("Account Setup failed: " + err.message);
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

  // Post-Login Redirect Handler
  async function handlePostLogin(defaultMessage, defaultRedirect) {
    if (window.pendingJoinCode) {
      const code = window.pendingJoinCode;
      window.pendingJoinCode = null;
      if (typeof window.startManagerClaimFlow === 'function') {
        window.startManagerClaimFlow(code);
        return;
      }
    }

    if (defaultRedirect) {
      window.location.href = defaultRedirect;
      return;
    }

    // Auto-redirect off marketing landing page to the last league associated with user's account
    let session = AuthEngine.getSession();
    if (session && database && session.uid) {
      try {
        const userSnap = await get(dbRef(database, `users/${session.uid}`));
        if (userSnap.exists()) {
          const uVal = userSnap.val();
          if (uVal.last_league) session.last_league = uVal.last_league;
          if (uVal.joinedLeagues) session.joinedLeagues = Array.isArray(uVal.joinedLeagues) ? uVal.joinedLeagues : Object.keys(uVal.joinedLeagues);
          if (uVal.adminLeagues) session.adminLeagues = Array.isArray(uVal.adminLeagues) ? uVal.adminLeagues : Object.keys(uVal.adminLeagues);
          if (uVal.claims) session.claims = { ...session.claims, ...uVal.claims };
        }
      } catch (e) {
        console.warn("Could not sync user profile on login:", e);
      }
    }

    const dbLastLeague = session?.last_league;
    const localLastLeague = localStorage.getItem('vault_last_league');

    let targetSlug = null;
    if (dbLastLeague && (
      session?.joinedLeagues?.includes(dbLastLeague) || 
      session?.adminLeagues?.includes(dbLastLeague) || 
      session?.claims?.[dbLastLeague] ||
      session?.isFounder
    )) {
      targetSlug = dbLastLeague;
    } else if (localLastLeague && (
      session?.joinedLeagues?.includes(localLastLeague) || 
      session?.adminLeagues?.includes(localLastLeague) || 
      session?.claims?.[localLastLeague]
    )) {
      targetSlug = localLastLeague;
    } else if (session?.isFounder) {
      // For founder account, default to gaywoodfantasyfootball or dmsfantasy
      if (localLastLeague === 'gaywoodfantasyfootball' || localLastLeague === 'dmsfantasy') {
        targetSlug = localLastLeague;
      } else {
        targetSlug = 'dmsfantasy';
      }
    } else if (session?.joinedLeagues && session.joinedLeagues.length > 0) {
      targetSlug = session.joinedLeagues[0];
    } else if (session?.adminLeagues && session.adminLeagues.length > 0) {
      targetSlug = session.adminLeagues[0];
    }

    if (targetSlug) {
      try {
        sessionStorage.removeItem('vault_founder_mode_active');
        sessionStorage.removeItem('vault_founder_nav_toggle');
      } catch (e) {}
      if (typeof AuthEngine.recordActiveLeague === 'function') {
        AuthEngine.recordActiveLeague(targetSlug);
      }
      const targetPath = typeof AuthEngine.resolveLeaguePath === 'function'
        ? AuthEngine.resolveLeaguePath(targetSlug)
        : (targetSlug === 'dmsfantasy' ? '/dmsfantasy/' : `/${encodeURIComponent(targetSlug)}`);
      window.location.href = targetPath;
      return;
    }

    if (defaultMessage) {
      alert(defaultMessage);
    }
  }

  // League Type Toggle Logic
  const inputLeagueType = document.getElementById('input-league-type');
  const groupPlatform = document.getElementById('group-platform');
  const groupPlatformsMultiple = document.getElementById('group-platforms-multiple');

  const groupEspnLeagueId = document.getElementById('group-espn-league-id');

  function updateEspnFields() {
    if (!inputPlatform) return;
    const isEspn = inputPlatform.value === 'espn' && (!inputLeagueType || inputLeagueType.value !== 'multiple-diff');
    const isYahoo = inputPlatform.value === 'yahoo';
    
    // Only show League ID input if they have selected a privacy option
    const modalInputAccess = document.getElementById('modal-input-access');
    const privacySelected = modalInputAccess ? (modalInputAccess.value !== '') : true;
    if (groupEspnLeagueId) groupEspnLeagueId.style.display = (isEspn && privacySelected) ? 'block' : 'none';

    // Show s2/swid if private or unknown
    const modalEspnPrivate = document.getElementById('modal-espn-private');
    if (modalEspnPrivate && modalInputAccess) {
      const isPrivateOrUnsure = modalInputAccess.value === 'private' || modalInputAccess.value === 'unknown';
      modalEspnPrivate.style.display = (isEspn && privacySelected && isPrivateOrUnsure) ? 'block' : 'none';
    }

    const modalYahooSection = document.getElementById('modal-yahoo-section');
    if (modalYahooSection) {
      modalYahooSection.style.display = (isYahoo && privacySelected) ? 'block' : 'none';
    }
  }

  const btnYahooOAuth = document.getElementById('btn-yahoo-oauth');
  if (btnYahooOAuth) {
    btnYahooOAuth.addEventListener('click', async () => {
      const statusEl = document.getElementById('yahoo-oauth-status');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--text-muted)';
        statusEl.textContent = 'Connecting to Yahoo Fantasy OAuth...';
      }
      try {
        const res = await fetch('/api/yahoo?action=auth-url');
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          throw new Error(data.error || 'Failed to generate Yahoo authorization link');
        }
      } catch (err) {
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.textContent = 'Connection error: ' + err.message;
        }
      }
    });
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

  // Smart ESPN Credential Paste & Copy Script Handler
  function attachSmartEspnPaste(s2El, swidEl, feedbackEl) {
    if (!s2El || !swidEl) return;
    const handlePaste = (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || e.target?.value || '';
      if (!text) return;

      let foundS2 = null;
      let foundSwid = null;

      const s2Match = text.match(/espn_s2[:=]\s*([^\s;]+)/i);
      if (s2Match) foundS2 = s2Match[1].trim();

      const swidMatch = text.match(/swid[:=]\s*([^\s;]+)/i);
      if (swidMatch) foundSwid = swidMatch[1].trim();

      if (!foundSwid && text.includes('{') && text.includes('}')) {
        const rawSwid = text.match(/\{[a-f0-9-]+\}/i);
        if (rawSwid) foundSwid = rawSwid[0];
      }

      if (foundS2 || foundSwid) {
        if (foundS2) s2El.value = foundS2;
        if (foundSwid) swidEl.value = foundSwid;
        if (feedbackEl) {
          feedbackEl.style.display = 'block';
          setTimeout(() => { if (feedbackEl) feedbackEl.style.display = 'none'; }, 4000);
        }
      }
    };

    s2El.addEventListener('paste', handlePaste);
    s2El.addEventListener('input', (e) => {
      if (e.target.value.includes('SWID') || e.target.value.includes('espn_s2') || e.target.value.includes('{')) {
        handlePaste({ target: e.target });
      }
    });

    swidEl.addEventListener('paste', handlePaste);
    swidEl.addEventListener('input', (e) => {
      if (e.target.value.includes('SWID') || e.target.value.includes('espn_s2') || e.target.value.includes('{')) {
        handlePaste({ target: e.target });
      }
    });
  }

  const s2ModalInput = document.getElementById('modal-espn-s2');
  const swidModalInput = document.getElementById('modal-espn-swid');
  const espnPasteFeedback = document.getElementById('espn-smart-paste-feedback');
  attachSmartEspnPaste(s2ModalInput, swidModalInput, espnPasteFeedback);

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
    setTimeout(() => {
      if (typeof window.startManagerClaimFlow === 'function') {
        window.startManagerClaimFlow(joinParam);
      }
    }, 300);
  }

  // Handle ?action=create URL Parameter
  const actionParam = urlParams.get('action');
  if (actionParam === 'create') {
    if (registerModal && typeof registerModal.showModal === 'function') {
      registerModal.showModal();
    }
  }
