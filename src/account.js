// account.js - Logic for "My Account" modal on league pages

document.addEventListener('DOMContentLoaded', () => {
    // Check if AuthEngine is available
    if (typeof window.AuthEngine === 'undefined') return;

    // Elements
    const btnMyAccount = document.getElementById('btn-my-account');
    const accountModal = document.getElementById('account-modal');
    
    if (!accountModal) return;
    
    const closeAccountModalBtn = document.getElementById('close-account-modal');
    const accountModalContent = document.getElementById('account-modal-content');

    window.startManagerClaimFlow = function(code, onSuccess) {
        const res = AuthEngine.processJoinCode(code);
        if (!res.success) {
            alert(res.message);
            return;
        }

        const league = res.league;
        const managers = league.managers || [];

        if (managers.length === 0) {
            // Fallback if no managers defined
            const finalRes = AuthEngine.finalizeJoin(code, 'unknown');
            if (finalRes.success) {
                alert(`Successfully joined ${league.name}!`);
                if (onSuccess) onSuccess();
            }
            return;
        }

        const managersHtml = managers.map(m => `
            <label style="display:flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border: 1px solid var(--border-line); margin-bottom: 0.5rem; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
                <input type="radio" name="manager_id" value="${m.id}" required> ${m.name}
            </label>
        `).join('');

        accountModalContent.innerHTML = `
            <h3 class="modal-title">Claim Your Profile</h3>
            <p class="modal-text">Select which manager you are in <strong>${league.name}</strong> to link your profile to their historical records.</p>
            <form id="claim-form">
                <div style="max-height: 250px; overflow-y: auto; margin-bottom: 1.5rem; padding-right: 0.5rem;">
                    ${managersHtml}
                </div>
                <button type="submit" class="btn-primary" style="width: 100%; justify-content: center;">Link Profile & Join &rarr;</button>
                <button type="button" id="btn-cancel-claim" style="width: 100%; background: none; border: none; color: var(--text-muted); margin-top: 0.5rem; cursor: pointer;">Cancel</button>
            </form>
        `;

        if (typeof accountModal.showModal === 'function' && !accountModal.open) {
            accountModal.showModal();
        }

        document.getElementById('claim-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const selected = document.querySelector('input[name="manager_id"]:checked');
            if (!selected) return;

            const finalRes = AuthEngine.finalizeJoin(code, selected.value);
            if (finalRes.success) {
                alert(`Successfully joined ${league.name}!`);
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.renderAccountModal('profile');
                }
            } else {
                alert(finalRes.message);
            }
        });

        document.getElementById('btn-cancel-claim').addEventListener('click', () => {
            window.renderAccountModal('profile');
        });
    };

    window.renderAccountModal = function(activeTab = 'profile') {
        const session = AuthEngine.getSession();
        
        if (!session) {
            accountModalContent.innerHTML = `
                <div style="text-align: center;">
                    <p style="margin-bottom: 1rem;">You are not signed in.</p>
                    <button id="btn-account-signin" class="btn-primary" style="padding: 0.5rem 1rem;">Sign In / Register &rarr;</button>
                </div>
            `;
            const btnSignin = document.getElementById('btn-account-signin');
            if (btnSignin) {
                btnSignin.addEventListener('click', () => {
                    window.location.href = '/'; // Go to hub to sign in
                });
            }
            return;
        }

        let currentLeagueId = null;
        if (typeof JOIN_CODES !== 'undefined') {
            for (const key in JOIN_CODES) {
                const cleanPath = JOIN_CODES[key].path.replace(/\/$/, '');
                if (cleanPath && window.location.pathname.includes(cleanPath)) {
                    currentLeagueId = JOIN_CODES[key].leagueId;
                    break;
                }
            }
        }
        
        // Only show admin tab if we are on a specific league page and user is founder
        const isLeagueAdmin = session.isFounder && currentLeagueId !== null;

        const tabsHTML = isLeagueAdmin ? `
            <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-line); margin-bottom: 1.5rem;">
                <button class="account-tab" data-tab="profile" style="background: none; border: none; padding: 0.5rem 0; cursor: pointer; color: ${activeTab === 'profile' ? 'var(--accent-gold)' : 'var(--text-muted)'}; font-weight: ${activeTab === 'profile' ? 'bold' : 'normal'}; border-bottom: ${activeTab === 'profile' ? '2px solid var(--accent-gold)' : 'none'};">My Profile</button>
                <button class="account-tab" data-tab="admin" style="background: none; border: none; padding: 0.5rem 0; cursor: pointer; color: ${activeTab === 'admin' ? 'var(--accent-gold)' : 'var(--text-muted)'}; font-weight: ${activeTab === 'admin' ? 'bold' : 'normal'}; border-bottom: ${activeTab === 'admin' ? '2px solid var(--accent-gold)' : 'none'};">Admin Dashboard</button>
            </div>
        ` : '';

        let contentHTML = '';

        if (activeTab === 'profile' || !isLeagueAdmin) {
            let leaguesListHTML = '';
            if (session.joinedLeagues && session.joinedLeagues.length > 0) {
                leaguesListHTML = session.joinedLeagues.map(leagueId => {
                    const info = Object.values(JOIN_CODES).find(l => l.leagueId === leagueId);
                    const name = info ? info.name : leagueId;
                    const path = info ? info.path : `/${leagueId}/`;
                    
                    let claimText = '';
                    if (session.claims && session.claims[leagueId]) {
                        const claimId = session.claims[leagueId];
                        const mgr = info && info.managers ? info.managers.find(m => m.id === claimId) : null;
                        if (mgr) claimText = ` <span style="color: var(--text-muted); font-size: 0.8rem;">(as ${mgr.name})</span>`;
                    }
                    
                    return `<li style="margin-bottom: 0.5rem;"><a href="${path}" style="color: var(--accent-gold); text-decoration: none; font-weight: 600;">${name}</a>${claimText}</li>`;
                }).join('');
            } else {
                leaguesListHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No leagues joined yet.</p>';
            }

            contentHTML = `
                <div class="user-info" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-line);">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--accent-gold); color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.4rem;">
                        ${session.avatar || '👤'}
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">${session.name || session.email}</h3>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">${session.email}</div>
                        ${session.isFounder ? '<div style="font-size: 0.8rem; color: var(--accent-gold); font-weight: bold; margin-top: 0.2rem; text-transform: uppercase;">Founder</div>' : ''}
                    </div>
                </div>

                <div class="joined-leagues" style="margin-bottom: 1.5rem;">
                    <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif);">Your Leagues</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${leaguesListHTML}
                    </ul>
                </div>

                <div class="add-league" style="margin-bottom: 1.5rem; background: var(--bg-card-alt, rgba(0,0,0,0.2)); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-line);">
                    <h4 style="margin-top: 0; margin-bottom: 0.5rem; font-family: var(--font-heading, 'Cinzel', serif); font-size: 0.95rem;">Join Another League</h4>
                    <form id="account-join-form" style="display: flex; gap: 0.5rem;">
                        <input type="text" id="account-join-code" placeholder="Enter Join Code" maxlength="6" required style="flex: 1; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: 4px; background: var(--bg-body, #fff); color: var(--text-main); font-family: monospace; text-transform: uppercase;">
                        <button type="submit" class="btn-primary" style="padding: 0.5rem 1rem;">Join</button>
                    </form>
                </div>

                <div style="text-align: right; margin-top: 1rem; border-top: 1px solid var(--border-line); padding-top: 1rem;">
                    <button id="btn-account-logout" style="background: none; border: 1px solid var(--border-line); color: var(--text-muted); padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;">Sign Out</button>
                </div>
            `;
        } else if (activeTab === 'admin' && isLeagueAdmin) {
            // ADMIN DASHBOARD CONTENT
            
            const code = Object.keys(JOIN_CODES).find(k => JOIN_CODES[k].leagueId === currentLeagueId);
            const info = code ? JOIN_CODES[code] : null;
            
            let inviteLinksHTML = '';
            if (code && info) {
                const joinLink = window.location.origin + '/?join=' + code;
                inviteLinksHTML = `
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid var(--border-line); border-radius: 4px;">
                        <div style="font-weight: bold; margin-bottom: 0.5rem; color: var(--accent-gold);">${info.name}</div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.85rem; color: var(--text-muted);">Join Code: <strong style="color: var(--text-main); font-family: monospace; font-size: 1rem; margin-left: 0.5rem;">${code}</strong></span>
                            <button class="btn-copy-code" data-copy="${code}" style="background: none; border: 1px solid var(--border-line); color: var(--text-muted); cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; border-radius: 3px;">Copy Code</button>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.85rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">Join Link: <span style="color: var(--text-main); font-size: 0.8rem; margin-left: 0.5rem;">${joinLink}</span></span>
                            <button class="btn-copy-link" data-copy="${joinLink}" style="background: none; border: 1px solid var(--border-line); color: var(--text-muted); cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; border-radius: 3px;">Copy Link</button>
                        </div>
                    </div>
                `;
            } else {
                inviteLinksHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Error loading league invite details.</p>';
            }

            contentHTML = `
                <div class="admin-dashboard-container">
                    
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold);">League Invites</h4>
                        ${inviteLinksHTML}
                    </div>

                    <div style="margin-bottom: 1.5rem; background: var(--bg-card-alt, rgba(0,0,0,0.2)); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-gold);">
                        <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold);">Transfer Admin Status</h4>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="email" id="admin-transfer-email" placeholder="New Admin Email" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: 4px; background: var(--bg-body); color: var(--text-main);">
                            <button id="btn-admin-transfer" class="btn-primary" style="padding: 0.5rem 1rem; background-color: #d32f2f;">Transfer</button>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold);">Registered Members</h4>
                        <div style="background: var(--bg-card-alt, rgba(0,0,0,0.2)); border: 1px solid var(--border-line); border-radius: 6px; overflow: hidden;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background: rgba(0,0,0,0.4); border-bottom: 1px solid var(--border-line); text-align: left;">
                                        <th style="padding: 0.75rem;">Display Name</th>
                                        <th style="padding: 0.75rem;">Email Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="2" style="padding: 1rem; text-align: center; color: var(--text-muted); font-style: italic;">No members have registered with this league yet.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold);">Site Customization</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted);"><input type="checkbox" disabled> Customize Site Theme (Coming Soon)</label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted);"><input type="checkbox" disabled> Customize Tabs & Records (Coming Soon)</label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted);"><input type="checkbox" disabled> Add Traditions & Paradigms (Coming Soon)</label>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold);">Member Permissions</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted);"><input type="checkbox" disabled> Can Publish Power Rankings (Coming Soon)</label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted);"><input type="checkbox" disabled> Can Publish Weekly Matchup Recaps (Coming Soon)</label>
                        </div>
                    </div>

                </div>
            `;
        }

        accountModalContent.innerHTML = tabsHTML + contentHTML;

        // Attach listeners
        document.querySelectorAll('.account-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                window.renderAccountModal(tab);
            });
        });

        if (activeTab === 'profile' || !isLeagueAdmin) {
            const joinForm = document.getElementById('account-join-form');
            if (joinForm) {
                joinForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const codeInput = document.getElementById('account-join-code');
                    const code = codeInput.value.trim().toUpperCase();
                    window.startManagerClaimFlow(code);
                });
            }

            const btnLogout = document.getElementById('btn-account-logout');
            if (btnLogout) {
                btnLogout.addEventListener('click', () => {
                    AuthEngine.logout();
                    accountModal.close();
                    window.location.reload();
                });
            }
        } else if (activeTab === 'admin' && isLeagueAdmin) {
            const btnTransfer = document.getElementById('btn-admin-transfer');
            if (btnTransfer) {
                btnTransfer.addEventListener('click', () => {
                    const email = document.getElementById('admin-transfer-email').value.trim();
                    if (email) {
                        alert(`Admin status transferred to ${email}. (Mock)`);
                        document.getElementById('admin-transfer-email').value = '';
                    }
                });
            }

            document.querySelectorAll('.btn-copy-code').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const val = e.target.getAttribute('data-copy');
                    navigator.clipboard.writeText(val);
                    const originalText = e.target.textContent;
                    e.target.textContent = 'Copied!';
                    setTimeout(() => e.target.textContent = originalText, 2000);
                });
            });

            document.querySelectorAll('.btn-copy-link').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const val = e.target.getAttribute('data-copy');
                    navigator.clipboard.writeText(val);
                    const originalText = e.target.textContent;
                    e.target.textContent = 'Copied!';
                    setTimeout(() => e.target.textContent = originalText, 2000);
                });
            });
        }
    };

    // Handlers for modal opening/closing
    if (btnMyAccount) {
        btnMyAccount.addEventListener('click', () => {
            window.renderAccountModal('profile');
            if (typeof accountModal.showModal === 'function') {
                accountModal.showModal();
            }
        });
    }

    if (closeAccountModalBtn) {
        closeAccountModalBtn.addEventListener('click', () => {
            accountModal.close();
            // Re-render to profile tab so next open is clean
            window.renderAccountModal('profile');
        });
    }

    // Listen for auth changes to update the button if needed
    window.addEventListener('vault_auth_changed', () => {
        const session = AuthEngine.getSession();
        if (session) {
            if (btnMyAccount) btnMyAccount.textContent = 'My Account';
        } else {
            if (btnMyAccount) btnMyAccount.textContent = 'Sign In';
        }
    });

    // Initial check
    const session = AuthEngine.getSession();
    if (!session) {
        if (btnMyAccount) btnMyAccount.textContent = 'Sign In';
    }
});
