// account.js - Logic for "My Account" modal on league pages

document.addEventListener('DOMContentLoaded', () => {
    // Check if AuthEngine is available
    if (typeof window.AuthEngine === 'undefined') return;

    // Elements
    const btnMyAccount = document.getElementById('btn-my-account');
    const accountModal = document.getElementById('account-modal');
    
    if (!btnMyAccount || !accountModal) return;
    
    const closeAccountModalBtn = document.getElementById('close-account-modal');
    const accountModalContent = document.getElementById('account-modal-content');

    window.renderAccountModal = function() {
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

        let leaguesListHTML = '';
        if (session.joinedLeagues && session.joinedLeagues.length > 0) {
            leaguesListHTML = session.joinedLeagues.map(leagueId => {
                const info = Object.values(JOIN_CODES).find(l => l.leagueId === leagueId);
                const name = info ? info.name : leagueId;
                const path = info ? info.path : `/${leagueId}/`;
                return `<li style="margin-bottom: 0.5rem;"><a href="${path}" style="color: var(--accent-gold); text-decoration: none; font-weight: 600;">${name}</a></li>`;
            }).join('');
        } else {
            leaguesListHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No leagues joined yet.</p>';
        }

        accountModalContent.innerHTML = `
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

            ${session.isFounder ? `
            <div class="admin-settings" style="margin-bottom: 1.5rem; background: var(--bg-card-alt, rgba(0,0,0,0.2)); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-gold);">
                <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold);">Admin Dashboard</h4>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.85rem; margin-bottom: 0.35rem; font-weight: 600;">Rename League</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="admin-rename-input" placeholder="New League Name" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: 4px; background: var(--bg-body); color: var(--text-main);">
                        <button id="btn-admin-rename" class="btn-primary" style="padding: 0.5rem 1rem;">Save</button>
                    </div>
                </div>

                <div>
                    <label style="display: block; font-size: 0.85rem; margin-bottom: 0.35rem; font-weight: 600;">Transfer Admin Status</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="email" id="admin-transfer-email" placeholder="New Admin Email" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: 4px; background: var(--bg-body); color: var(--text-main);">
                        <button id="btn-admin-transfer" class="btn-primary" style="padding: 0.5rem 1rem; background-color: #d32f2f;">Transfer</button>
                    </div>
                </div>
            </div>
            ` : ''}

            <div style="text-align: right; margin-top: 1rem; border-top: 1px solid var(--border-line); padding-top: 1rem;">
                <button id="btn-account-logout" style="background: none; border: 1px solid var(--border-line); color: var(--text-muted); padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;">Sign Out</button>
            </div>
        `;

        // Admin event listeners
        if (session.isFounder) {
            const btnRename = document.getElementById('btn-admin-rename');
            if (btnRename) {
                btnRename.addEventListener('click', () => {
                    const val = document.getElementById('admin-rename-input').value.trim();
                    if (val) {
                        alert(\`League renamed to "\${val}". (Mock)\`);
                        document.getElementById('admin-rename-input').value = '';
                    }
                });
            }

            const btnTransfer = document.getElementById('btn-admin-transfer');
            if (btnTransfer) {
                btnTransfer.addEventListener('click', () => {
                    const email = document.getElementById('admin-transfer-email').value.trim();
                    if (email) {
                        alert(\`Admin status transferred to \${email}. (Mock)\`);
                        document.getElementById('admin-transfer-email').value = '';
                    }
                });
            }
        }

        const joinForm = document.getElementById('account-join-form');
        if (joinForm) {
            joinForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const codeInput = document.getElementById('account-join-code');
                const code = codeInput.value.trim().toUpperCase();
                
                const res = AuthEngine.processJoinCode(code);
                if (res.success) {
                    alert(`Successfully joined ${res.league.name}!`);
                    renderAccountModal(); // Re-render to show new league
                } else {
                    alert(res.message);
                }
            });
        }

        const btnLogout = document.getElementById('btn-account-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                AuthEngine.logout();
                accountModal.close();
                // Optionally redirect to home or reload
                window.location.reload();
            });
        }
    }

    // Handlers
    if (btnMyAccount) {
        btnMyAccount.addEventListener('click', () => {
            window.renderAccountModal();
            if (typeof accountModal.showModal === 'function') {
                accountModal.showModal();
            }
        });
    }

    if (closeAccountModalBtn) {
        closeAccountModalBtn.addEventListener('click', () => {
            accountModal.close();
        });
    }

    // Listen for auth changes to update the button if needed
    window.addEventListener('vault_auth_changed', () => {
        const session = AuthEngine.getSession();
        if (session) {
            btnMyAccount.textContent = 'My Account';
        } else {
            btnMyAccount.textContent = 'Sign In';
        }
    });

    // Initial check
    const session = AuthEngine.getSession();
    if (!session) {
        if (btnMyAccount) btnMyAccount.textContent = 'Sign In';
    }
});
