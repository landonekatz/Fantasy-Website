// account.js - Logic for "My Account" modal & Universal League Import on all pages
import { formatManagerDisplayName } from '/src/formatters.js';
import { database } from '/src/firebase.js';
import { ref as dbRef, set, get, child, update } from 'firebase/database';

(function() {
    // Elements
    const btnMyAccount = document.getElementById('btn-my-account');
    let accountModal = document.getElementById('account-modal');
    
    // Create account modal dynamically if missing from page DOM
    if (!accountModal) {
        accountModal = document.createElement('dialog');
        accountModal.id = 'account-modal';
        accountModal.className = 'modal';
        accountModal.style.maxWidth = '520px';
        accountModal.style.width = '92%';
        accountModal.innerHTML = `
            <button id="close-account-modal" class="modal-close-x">&times;</button>
            <div id="account-modal-content"></div>
        `;
        document.body.appendChild(accountModal);
    } else {
        accountModal.style.maxWidth = '520px';
        accountModal.style.width = '92%';
    }
    
    const closeAccountModalBtn = document.getElementById('close-account-modal');
    const accountModalContent = document.getElementById('account-modal-content');

    // ==========================================
    // DIRECT MANAGER CLAIM WORKFLOW (With Conflict Check)
    // ==========================================
    window.startDirectManagerClaim = function(leagueSlug, targetManagerId, onSuccess) {
        if (typeof window.AuthEngine === 'undefined') return;
        const app = window.app || window.appInstance;
        const leagueName = app?.leagueSettings?.name || (leagueSlug === 'gaywoodfantasy' ? 'Gaywood / Katz League' : (leagueSlug === 'dmsfantasy' ? 'The Dumbarton League' : 'Fantasy League'));
        const managers = app?.members || app?.managers || [];
        const targetMgr = managers.find(m => m.id === targetManagerId) || { id: targetManagerId, name: targetManagerId };
        const session = window.AuthEngine.getSession();

        if (!session) {
            // Not signed in -> Prompt Sign In / Registration to claim this specific profile
            accountModalContent.innerHTML = `
                <div style="text-align: center; padding: 6px 0;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.3); color: var(--accent-gold, #b45309); font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">TFV</div>
                    <h3 class="modal-title" style="margin-bottom: 6px; font-size: 1.3rem;">Claim Manager Profile</h3>
                    <p class="modal-text" style="margin-bottom: 1.25rem; font-size: 0.9rem; color: var(--text-secondary, #475569);">
                        Sign in or create your account to claim <strong>${targetMgr.name || targetMgr.canonical_name || targetManagerId}</strong>'s historical profile in <strong>${leagueName}</strong>.
                    </p>
                    
                    <button id="btn-claim-google" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; margin-bottom: 1rem; cursor: pointer; border: 1px solid var(--border-line, #cbd5e1); background: #ffffff; color: #0f172a; font-weight: 600; border-radius: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                        Continue with Google
                    </button>

                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; color: var(--text-muted, #64748b); font-size: 0.8rem;">
                        <hr style="flex: 1; border: none; border-top: 1px solid var(--border-line, #e2e8f0);">
                        <span>OR EMAIL</span>
                        <hr style="flex: 1; border: none; border-top: 1px solid var(--border-line, #e2e8f0);">
                    </div>

                    <form id="claim-email-form">
                        <input type="email" id="claim-input-email" class="admin-input" placeholder="Your Email Address" required style="width: 100%; margin-bottom: 0.75rem; box-sizing: border-box; padding: 0.6rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px;">
                        <input type="password" id="claim-input-password" class="admin-input" placeholder="Password" required style="width: 100%; margin-bottom: 1rem; box-sizing: border-box; padding: 0.6rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px;">
                        <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem;">Sign In &amp; Claim Profile &rarr;</button>
                    </form>
                </div>
            `;

            if (typeof accountModal.showModal === 'function' && !accountModal.open) {
                accountModal.showModal();
            }

            document.getElementById('btn-claim-google')?.addEventListener('click', async () => {
                try {
                    await window.AuthEngine.loginWithGoogle();
                    window.startDirectManagerClaim(leagueSlug, targetManagerId, onSuccess);
                } catch (e) {
                    console.error("Google sign in failed", e);
                    alert("Google sign in failed. Please try again.");
                }
            });

            document.getElementById('claim-email-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const em = document.getElementById('claim-input-email').value.trim();
                const pw = document.getElementById('claim-input-password').value;
                try {
                    await window.AuthEngine.loginWithEmail(em, pw);
                    window.startDirectManagerClaim(leagueSlug, targetManagerId, onSuccess);
                } catch (err) {
                    console.error("Email sign in failed", err);
                    alert(err.message || "Sign in failed.");
                }
            });
            return;
        }

        // Conflict check: if user already claimed a DIFFERENT manager in this league
        const currentClaimId = session.claims ? session.claims[leagueSlug] : null;
        if (currentClaimId && currentClaimId !== targetManagerId) {
            const currentMgr = managers.find(m => m.id === currentClaimId) || { name: currentClaimId };
            accountModalContent.innerHTML = `
                <div style="text-align: center; padding: 1rem 0;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; border: 1px solid #fecaca; color: #dc2626; font-size: 1.2rem; font-weight: 800; margin-bottom: 12px;">!</div>
                    <h3 class="modal-title" style="color: #b91c1c; margin-bottom: 0.5rem;">Account Claim Conflict</h3>
                    <p style="color: var(--text-secondary, #475569); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.25rem;">
                        This direct claim link is for <strong>${targetMgr.name || targetMgr.canonical_name || targetManagerId}</strong>.<br><br>
                        However, your active account (<strong>${session.email}</strong>) is currently linked to <strong>${currentMgr.name || currentMgr.canonical_name || currentClaimId}</strong> in this league.
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                        <button id="btn-conflict-reauth" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem;">
                            Sign Out &amp; Switch Account &rarr;
                        </button>
                        <button type="button" id="btn-conflict-cancel" style="background: none; border: 1px solid var(--border-line, #cbd5e1); color: var(--text-muted, #64748b); padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                            Cancel &amp; Keep Current Profile
                        </button>
                    </div>
                </div>
            `;
            if (typeof accountModal.showModal === 'function' && !accountModal.open) {
                accountModal.showModal();
            }

            document.getElementById('btn-conflict-reauth')?.addEventListener('click', () => {
                accountModal.close();
                window.AuthEngine.logout();
            });

            document.getElementById('btn-conflict-cancel')?.addEventListener('click', () => {
                accountModal.close();
            });
            return;
        }

        // Confirmation modal
        const targetName = targetMgr.name || targetMgr.canonical_name || targetManagerId;
        accountModalContent.innerHTML = `
            <div style="text-align: center; padding: 1rem 0;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #dcfce7; border: 1px solid #bbf7d0; color: #15803d; font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">✓</div>
                <h3 class="modal-title" style="margin-bottom: 0.5rem;">Link Manager Profile</h3>
                <p style="color: var(--text-secondary, #475569); font-size: 0.92rem; line-height: 1.5; margin-bottom: 1.5rem;">
                    Confirm linking your account (<strong>${session.email}</strong>) to <strong>${targetName}</strong> in <strong>${leagueName}</strong>.
                </p>
                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" id="btn-cancel-direct-claim" style="flex: 1; background: none; border: 1px solid var(--border-line, #cbd5e1); color: var(--text-muted, #64748b); padding: 0.65rem; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        Cancel
                    </button>
                    <button type="button" id="btn-confirm-direct-claim" class="btn-primary" style="flex: 2; justify-content: center; padding: 0.65rem; font-weight: 600; cursor: pointer;">
                        Confirm &amp; Link Profile &rarr;
                    </button>
                </div>
            </div>
        `;
        if (typeof accountModal.showModal === 'function' && !accountModal.open) {
            accountModal.showModal();
        }

        document.getElementById('btn-confirm-direct-claim')?.addEventListener('click', async () => {
            await window.AuthEngine.linkUserLeague(leagueSlug, 'member', leagueName);
            await window.AuthEngine.claimManagerProfile(leagueSlug, targetManagerId, targetName);
            alert(`Profile successfully linked! Welcome, ${targetName}.`);
            accountModal.close();
            if (onSuccess) onSuccess();
            else window.location.reload();
        });

        document.getElementById('btn-cancel-direct-claim')?.addEventListener('click', () => {
            accountModal.close();
        });
    };

    // ==========================================
    // ADMIN STATUS TRANSFER WORKFLOW
    // ==========================================
    window.startAdminTransferFlow = function(leagueSlug, onSuccess) {
        if (typeof window.AuthEngine === 'undefined') return;
        const app = window.app || window.appInstance;
        const leagueName = app?.leagueSettings?.name || (leagueSlug === 'gaywoodfantasy' ? 'Gaywood / Katz League' : (leagueSlug === 'dmsfantasy' ? 'The Dumbarton League' : 'Fantasy League'));
        const managers = app?.members || app?.managers || [];
        const session = window.AuthEngine.getSession();

        if (!session) {
            // Not signed in -> Prompt Sign In
            accountModalContent.innerHTML = `
                <div style="text-align: center; padding: 6px 0;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">Admin</div>
                    <h3 class="modal-title" style="margin-bottom: 6px; font-size: 1.3rem;">Accept Admin Transfer</h3>
                    <p class="modal-text" style="margin-bottom: 1.25rem; font-size: 0.9rem; color: var(--text-secondary, #475569);">
                        Sign in to accept the Commissioner / Admin status transfer for <strong>${leagueName}</strong>.
                    </p>
                    
                    <button id="btn-admin-google" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; margin-bottom: 1rem; cursor: pointer; border: 1px solid var(--border-line, #cbd5e1); background: #ffffff; color: #0f172a; font-weight: 600; border-radius: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                        Continue with Google
                    </button>

                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; color: var(--text-muted, #64748b); font-size: 0.8rem;">
                        <hr style="flex: 1; border: none; border-top: 1px solid var(--border-line, #e2e8f0);">
                        <span>OR EMAIL</span>
                        <hr style="flex: 1; border: none; border-top: 1px solid var(--border-line, #e2e8f0);">
                    </div>

                    <form id="admin-email-form">
                        <input type="email" id="admin-input-email" class="admin-input" placeholder="Your Email Address" required style="width: 100%; margin-bottom: 0.75rem; box-sizing: border-box; padding: 0.6rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px;">
                        <input type="password" id="admin-input-password" class="admin-input" placeholder="Password" required style="width: 100%; margin-bottom: 1rem; box-sizing: border-box; padding: 0.6rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px;">
                        <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem;">Sign In &amp; Proceed &rarr;</button>
                    </form>
                </div>
            `;

            if (typeof accountModal.showModal === 'function' && !accountModal.open) {
                accountModal.showModal();
            }

            document.getElementById('btn-admin-google')?.addEventListener('click', async () => {
                try {
                    await window.AuthEngine.loginWithGoogle();
                    window.startAdminTransferFlow(leagueSlug, onSuccess);
                } catch (e) {
                    console.error("Google sign in failed", e);
                    alert("Google sign in failed.");
                }
            });

            document.getElementById('admin-email-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const em = document.getElementById('admin-input-email').value.trim();
                const pw = document.getElementById('admin-input-password').value;
                try {
                    await window.AuthEngine.loginWithEmail(em, pw);
                    window.startAdminTransferFlow(leagueSlug, onSuccess);
                } catch (err) {
                    console.error("Email sign in failed", err);
                    alert(err.message || "Sign in failed.");
                }
            });
            return;
        }

        // Check if user is already a claimed member of this league
        const currentClaimId = session.claims ? session.claims[leagueSlug] : null;
        let memberSelectHtml = '';
        if (!currentClaimId && managers.length > 0) {
            memberSelectHtml = `
                <div style="margin: 1.25rem 0; padding: 1rem; background: #f8fafc; border: 1px solid var(--border-line, #e2e8f0); border-radius: 6px; text-align: left;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #b45309; margin-bottom: 0.35rem;">Select Your Manager Identity</label>
                    <p style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 0.5rem;">League Admins must be verified members. Please select which manager you are:</p>
                    <select id="transfer-mgr-select" style="width: 100%; padding: 0.55rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px; font-size: 0.88rem; background: #fff; color: #0f172a;">
                        ${managers.map(m => `<option value="${m.id}">${m.name || m.canonical_name || m.id}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        accountModalContent.innerHTML = `
            <div style="text-align: center; padding: 1rem 0;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">Admin</div>
                <h3 class="modal-title" style="margin-bottom: 0.5rem;">Accept League Admin Role</h3>
                <p style="color: var(--text-secondary, #475569); font-size: 0.92rem; line-height: 1.5; margin-bottom: 0.75rem;">
                    You are accepting commissioner &amp; administrative ownership of <strong>${leagueName}</strong> for account <strong>${session.email}</strong>.
                </p>
                ${memberSelectHtml}
                <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
                    <button type="button" id="btn-cancel-transfer" style="flex: 1; background: none; border: 1px solid var(--border-line, #cbd5e1); color: var(--text-muted, #64748b); padding: 0.65rem; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        Cancel
                    </button>
                    <button type="button" id="btn-confirm-transfer" class="btn-primary" style="flex: 2; justify-content: center; padding: 0.65rem; font-weight: 600; cursor: pointer;">
                        Accept Admin Role &rarr;
                    </button>
                </div>
            </div>
        `;
        if (typeof accountModal.showModal === 'function' && !accountModal.open) {
            accountModal.showModal();
        }

        document.getElementById('btn-confirm-transfer')?.addEventListener('click', async () => {
            const selectEl = document.getElementById('transfer-mgr-select');
            if (selectEl && selectEl.value) {
                const selectedMgr = managers.find(m => m.id === selectEl.value);
                await window.AuthEngine.claimManagerProfile(leagueSlug, selectEl.value, selectedMgr?.name);
            }
            await window.AuthEngine.linkUserLeague(leagueSlug, 'admin', leagueName);
            await window.AuthEngine.transferAdminRole(leagueSlug, session.email);
            alert(`Congratulations! You are now the official Admin of ${leagueName}.`);
            accountModal.close();
            if (onSuccess) onSuccess();
            else window.location.reload();
        });

        document.getElementById('btn-cancel-transfer')?.addEventListener('click', () => {
            accountModal.close();
        });
    };

    // ==========================================
    // ADMIN DASHBOARD: INITIATE ADMIN TRANSFER MODAL
    // ==========================================
    window.openAdminTransferModal = function(leagueSlug) {
        if (typeof window.AuthEngine === 'undefined') return;
        const app = window.app || window.appInstance;
        const leagueName = app?.leagueSettings?.name || (leagueSlug === 'gaywoodfantasy' ? 'Gaywood / Katz League' : (leagueSlug === 'dmsfantasy' ? 'The Dumbarton League' : 'Fantasy League'));
        const transferLink = `${window.location.origin}/${leagueSlug}/?action=transfer_admin&league=${leagueSlug}`;

        accountModalContent.innerHTML = `
            <div style="text-align: left; padding: 6px 0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-size: 1.1rem; font-weight: 800;">Admin</div>
                    <div>
                        <h3 class="modal-title" style="margin: 0; font-size: 1.25rem;">Transfer Admin Status</h3>
                        <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: var(--text-muted, #64748b);">${leagueName}</p>
                    </div>
                </div>

                <p style="font-size: 0.88rem; color: var(--text-secondary, #334155); margin-bottom: 1.25rem; line-height: 1.5;">
                    Transferring admin status grants full commissioner controls for this league archive to another member.
                </p>

                <!-- Method 1: Email Transfer Invitation -->
                <div style="padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Email Transfer Invitation</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="email" id="transfer-recipient-email" class="admin-input" placeholder="recipient@example.com" style="flex: 1; min-width: 200px; padding: 8px 10px; font-size: 0.88rem; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <button id="btn-send-transfer-email" class="btn-primary" style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 4px; white-space: nowrap;">Send Invite</button>
                    </div>
                    <div id="transfer-email-feedback" style="display: none; margin-top: 6px; font-size: 0.82rem;"></div>
                </div>

                <!-- Method 2: Copy Transfer Link -->
                <div style="padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 1.25rem;">
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Or Copy Admin Transfer Link</label>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-family: monospace; font-size: 0.8rem; color: #334155; word-break: break-all; flex: 1; padding: 6px 8px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px;">${transferLink}</span>
                        <button id="btn-copy-transfer-link" class="btn" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; white-space: nowrap;">Copy Link</button>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <button id="btn-close-transfer-modal" class="btn" style="padding: 8px 16px; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; font-weight: 600; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        if (typeof accountModal.showModal === 'function' && !accountModal.open) {
            accountModal.showModal();
        }

        document.getElementById('btn-copy-transfer-link')?.addEventListener('click', () => {
            navigator.clipboard.writeText(transferLink).then(() => {
                const btn = document.getElementById('btn-copy-transfer-link');
                if (btn) {
                    btn.textContent = '✓ Copied!';
                    btn.style.background = '#15803d';
                    btn.style.color = '#fff';
                    setTimeout(() => {
                        btn.textContent = 'Copy Link';
                        btn.style.background = '#fff';
                        btn.style.color = '';
                    }, 2000);
                }
            });
        });

        document.getElementById('btn-send-transfer-email')?.addEventListener('click', async () => {
            const emailInput = document.getElementById('transfer-recipient-email');
            const targetEmail = emailInput?.value.trim();
            const feedback = document.getElementById('transfer-email-feedback');
            if (!targetEmail || !targetEmail.includes('@')) {
                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#dc2626';
                    feedback.textContent = 'Please enter a valid email address.';
                }
                return;
            }

            const sendBtn = document.getElementById('btn-send-transfer-email');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
            }

            try {
                // Attempt to send email invite
                try {
                    await fetch('/api/email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: targetEmail,
                            subject: `Admin Transfer Invitation for ${leagueName}`,
                            body: `You have been invited to take over Admin / Commissioner status for ${leagueName}.\n\nClick the link below to accept:\n${transferLink}`
                        })
                    });
                } catch (e) {}

                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#15803d';
                    feedback.innerHTML = `✓ Admin transfer invitation sent to <strong>${targetEmail}</strong>! When they sign in with this link, admin role will be assigned.`;
                }
                if (emailInput) emailInput.value = '';
            } catch (e) {
                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#dc2626';
                    feedback.textContent = 'Failed to send invite. Please copy and send the transfer link manually.';
                }
            } finally {
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Send Invite';
                }
            }
        });

        document.getElementById('btn-close-transfer-modal')?.addEventListener('click', () => {
            accountModal.close();
        });
    };

    // ==========================================
    // ADMIN DASHBOARD: EMAIL MANAGER CLAIM LINK MODAL
    // ==========================================
    window.openEmailClaimModal = function(leagueSlug, managerId, managerName) {
        if (typeof window.AuthEngine === 'undefined') return;
        const app = window.app || window.appInstance;
        const leagueName = app?.leagueSettings?.name || (leagueSlug === 'gaywoodfantasy' ? 'Gaywood / Katz League' : (leagueSlug === 'dmsfantasy' ? 'The Dumbarton League' : 'Fantasy League'));
        const claimLink = `${window.location.origin}/${leagueSlug}/?action=claim_manager&manager=${encodeURIComponent(managerId)}`;

        accountModalContent.innerHTML = `
            <div style="text-align: left; padding: 6px 0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.3); color: #b45309; font-size: 1.1rem; font-weight: 800;">TFV</div>
                    <div>
                        <h3 class="modal-title" style="margin: 0; font-size: 1.25rem;">Email Claim Link</h3>
                        <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: var(--text-muted, #64748b);">Invite <strong>${managerName}</strong> to claim their profile</p>
                    </div>
                </div>

                <p style="font-size: 0.88rem; color: var(--text-secondary, #334155); margin-bottom: 1.25rem; line-height: 1.5;">
                    Send an email claim link directly to <strong>${managerName}</strong> so they can link their profile in <strong>${leagueName}</strong>.
                </p>

                <!-- Method 1: Email Claim Link -->
                <div style="padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Manager Email Address</label>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <input type="email" id="claim-recipient-email" class="admin-input" placeholder="${managerName.toLowerCase().replace(/\s+/g, '')}@example.com" style="flex: 1; min-width: 200px; padding: 8px 10px; font-size: 0.88rem; border: 1px solid #cbd5e1; border-radius: 4px;">
                        <button id="btn-send-claim-email" class="btn-primary" style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 4px; white-space: nowrap;">Send Claim Link</button>
                    </div>
                    <div id="claim-email-feedback" style="display: none; margin-top: 6px; font-size: 0.82rem;"></div>
                </div>

                <!-- Method 2: Copy Claim Link -->
                <div style="padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 1.25rem;">
                    <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">Or Copy Direct Claim Link</label>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-family: monospace; font-size: 0.8rem; color: #334155; word-break: break-all; flex: 1; padding: 6px 8px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px;">${claimLink}</span>
                        <button id="btn-copy-manager-claim-link" class="btn" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; white-space: nowrap;">Copy Link</button>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <button id="btn-close-claim-modal" class="btn" style="padding: 8px 16px; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; font-weight: 600; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        if (typeof accountModal.showModal === 'function' && !accountModal.open) {
            accountModal.showModal();
        }

        document.getElementById('btn-copy-manager-claim-link')?.addEventListener('click', () => {
            navigator.clipboard.writeText(claimLink).then(() => {
                const btn = document.getElementById('btn-copy-manager-claim-link');
                if (btn) {
                    btn.textContent = '✓ Copied!';
                    btn.style.background = '#15803d';
                    btn.style.color = '#fff';
                    setTimeout(() => {
                        btn.textContent = 'Copy Link';
                        btn.style.background = '#fff';
                        btn.style.color = '';
                    }, 2000);
                }
            });
        });

        document.getElementById('btn-send-claim-email')?.addEventListener('click', async () => {
            const emailInput = document.getElementById('claim-recipient-email');
            const targetEmail = emailInput?.value.trim();
            const feedback = document.getElementById('claim-email-feedback');
            if (!targetEmail || !targetEmail.includes('@')) {
                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#dc2626';
                    feedback.textContent = 'Please enter a valid email address.';
                }
                return;
            }

            const sendBtn = document.getElementById('btn-send-claim-email');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
            }

            try {
                try {
                    await fetch('/api/email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: targetEmail,
                            subject: `Claim your fantasy football manager profile for ${leagueName}`,
                            body: `Hi ${managerName},\n\nYou have been invited to claim your historical profile and statistics in ${leagueName} on The Fantasy Vault.\n\nClick the link below to claim your team:\n${claimLink}`
                        })
                    });
                } catch (e) {}

                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#15803d';
                    feedback.innerHTML = `✓ Claim invitation link sent to <strong>${targetEmail}</strong>!`;
                }
                if (emailInput) emailInput.value = '';
            } catch (e) {
                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#dc2626';
                    feedback.textContent = 'Failed to send invite. Please copy and send the claim link manually.';
                }
            } finally {
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Send Claim Link';
                }
            }
        });

        document.getElementById('btn-close-claim-modal')?.addEventListener('click', () => {
            accountModal.close();
        });
    };

    // ==========================================
    // GENERAL JOIN CODE & CLAIM FLOW (With Guest Option)
    // ==========================================
    window.startManagerClaimFlow = async function(code, onSuccess) {
        if (typeof window.AuthEngine === 'undefined') return;
        const res = typeof window.AuthEngine.resolveJoinCode === 'function'
            ? await window.AuthEngine.resolveJoinCode(code)
            : window.AuthEngine.processJoinCode(code);
            
        if (!res.success) {
            alert(res.message);
            return;
        }

        const league = res.league;
        const session = window.AuthEngine.getSession();

        if (accountModal) {
            accountModal.style.maxWidth = '520px';
        }

        if (!session) {
            accountModalContent.innerHTML = `
                <div style="text-align: center; padding: 6px 0;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.3); color: var(--accent-gold, #b45309); font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">TFV</div>
                    <h3 class="modal-title" style="margin-bottom: 6px; font-size: 1.3rem;">Join ${league.name}</h3>
                    <p class="modal-text" style="margin-bottom: 1.25rem; font-size: 0.9rem; color: var(--text-secondary, #475569);">Sign in or create your free account to join the league and claim your manager profile.</p>
                    
                    <button id="btn-claim-google" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; margin-bottom: 1rem; cursor: pointer; border: 1px solid var(--border-line, #cbd5e1); background: #ffffff; color: #0f172a; font-weight: 600; border-radius: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                        Continue with Google
                    </button>

                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; color: var(--text-muted, #64748b); font-size: 0.8rem;">
                        <hr style="flex: 1; border: none; border-top: 1px solid var(--border-line, #e2e8f0);">
                        <span>OR WITH EMAIL</span>
                        <hr style="flex: 1; border: none; border-top: 1px solid var(--border-line, #e2e8f0);">
                    </div>

                    <form id="claim-email-form">
                        <input type="email" id="claim-input-email" class="admin-input" placeholder="Your Email Address" required style="width: 100%; margin-bottom: 0.75rem; box-sizing: border-box; padding: 0.6rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px;">
                        <input type="password" id="claim-input-password" class="admin-input" placeholder="Password" required style="width: 100%; margin-bottom: 1rem; box-sizing: border-box; padding: 0.6rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px;">
                        <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem; font-weight: 600;">Sign In / Create Account &rarr;</button>
                    </form>
                </div>
            `;

            if (typeof accountModal.showModal === 'function' && !accountModal.open) {
                accountModal.showModal();
            }

            document.getElementById('btn-claim-google')?.addEventListener('click', async () => {
                try {
                    await window.AuthEngine.loginWithGoogle();
                    window.startManagerClaimFlow(code, onSuccess);
                } catch (e) {
                    console.error("Google sign in failed", e);
                    alert("Google sign in failed.");
                }
            });

            document.getElementById('claim-email-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const em = document.getElementById('claim-input-email').value.trim();
                const pw = document.getElementById('claim-input-password').value;
                const btn = e.target.querySelector('button[type="submit"]');
                if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
                try {
                    await window.AuthEngine.loginWithEmail(em, pw);
                    window.startManagerClaimFlow(code, onSuccess);
                } catch (err) {
                    if (btn) { btn.disabled = false; btn.textContent = 'Sign In / Create Account →'; }
                    console.error("Email sign in failed", err);
                    alert(err.message || "Sign in failed.");
                }
            });
            return;
        }

        const app = window.app || window.appInstance;
        let managers = league.managers || (app?.members) || (app?.managers) || [];
        
        // Ensure fresh claims from RTDB
        let claims = league.claims || app?.claims || {};
        if (database) {
            try {
                const snap = await get(dbRef(database, `leagues/${league.leagueId}/claims`));
                if (snap.exists()) claims = snap.val() || {};
            } catch (e) {}
        }

        // Categorize managers into available vs claimed
        const availableManagers = [];
        const claimedManagers = [];

        managers.forEach(m => {
            const mId = m.id || m.manager_id;
            const claim = claims[mId];
            const isSelf = claim && (claim.userId === session.uid || (claim.email && claim.email.toLowerCase() === (session.email || '').toLowerCase()));
            const isClaimed = claim && claim.userId && !isSelf;

            if (isClaimed) {
                claimedManagers.push({ ...m, id: mId, isClaimed: true });
            } else {
                availableManagers.push({ ...m, id: mId, isSelf: Boolean(isSelf) });
            }
        });

        // Sort available so if user has an existing claim, it appears at top
        availableManagers.sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0));

        let availableHtml = '';
        if (availableManagers.length > 0) {
            availableHtml = availableManagers.map((m, idx) => {
                const isSelected = m.isSelf || idx === 0;
                const baseName = m.name || m.canonical_name || m.manager_name || m.id;
                const mName = formatManagerDisplayName(baseName, m.nickname || claims[m.id]?.nickname || '');
                return `
                <label style="display:flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1rem; border: 1.5px solid var(--border-line, #e2e8f0); margin-bottom: 0.5rem; border-radius: 8px; cursor: pointer; background: #fff; transition: all 0.2s;">
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <input type="radio" name="manager_id" value="${m.id}" required ${isSelected ? 'checked' : ''} style="cursor: pointer; accent-color: var(--accent-gold, #b45309);"> 
                        <div>
                            <strong style="color: var(--text-primary, #0f172a); font-size: 0.95rem;">${mName}</strong>
                            ${m.team_name ? `<div style="font-size: 0.78rem; color: var(--text-muted, #64748b);">${m.team_name}</div>` : ''}
                        </div>
                    </span>
                    ${m.isSelf ? '<span style="color: #15803d; font-size: 0.75rem; font-weight: 700; background: #dcfce7; padding: 2px 8px; border-radius: 4px;">✓ Linked to You</span>' : '<span style="color: #b45309; font-size: 0.75rem; font-weight: 600; background: #fef3c7; padding: 2px 8px; border-radius: 4px;">Available</span>'}
                </label>
                `;
            }).join('');
        } else {
            availableHtml = `<div style="padding: 1rem; text-align: center; color: var(--text-muted, #64748b); background: #f8fafc; border-radius: 6px; font-size: 0.88rem;">All manager profiles in ${league.name} have already been claimed. You can still join as a guest viewer to access all historical records and analytics.</div>`;
        }

        let claimedHtml = '';
        if (claimedManagers.length > 0) {
            claimedHtml = `
                <details style="margin-top: 1rem; margin-bottom: 1rem; font-size: 0.85rem; color: var(--text-muted, #64748b);">
                    <summary style="cursor: pointer; font-weight: 600; color: var(--text-secondary, #475569); margin-bottom: 0.5rem;">Claimed Managers (${claimedManagers.length})</summary>
                    <div style="display: flex; flex-direction: column; gap: 0.35rem; padding-left: 0.5rem;">
                        ${claimedManagers.map(m => {
                            const baseName = m.name || m.canonical_name || m.manager_name || m.id;
                            const mName = formatManagerDisplayName(baseName, m.nickname || claims[m.id]?.nickname || '');
                            return `
                                <div style="display:flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border: 1px dashed var(--border-line, #e2e8f0); border-radius: 6px; background: #f8fafc; opacity: 0.7;">
                                    <span style="color: var(--text-muted, #64748b); font-size: 0.88rem;">${mName}</span>
                                    <span style="color: var(--text-muted, #64748b); font-size: 0.75rem; font-weight: 600;">(Claimed)</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }

        accountModalContent.innerHTML = `
            <div style="padding: 4px 0;">
                <h3 class="modal-title" style="margin-top: 0; margin-bottom: 6px; font-size: 1.25rem;">Claim Your Manager Profile</h3>
                <p class="modal-text" style="color: var(--text-secondary, #475569); font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.45;">Select your team in <strong>${league.name}</strong> to link your account to your historical records, head-to-head match history, and draft analysis.</p>
                <form id="claim-form">
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary, #475569); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Available Managers:</div>
                    <div style="max-height: 280px; overflow-y: auto; margin-bottom: 1rem; padding-right: 0.25rem;">
                        ${availableHtml}
                    </div>
                    ${claimedHtml}
                    ${availableManagers.length > 0 ? `
                        <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px; font-weight: 700; font-size: 0.95rem; margin-top: 0.5rem;">Confirm &amp; Join League &rarr;</button>
                    ` : ''}
                    
                    <div style="text-align: center; margin-top: 1rem; border-top: 1px solid var(--border-line, #e2e8f0); padding-top: 0.85rem;">
                        <button type="button" id="btn-join-as-guest" style="background: none; border: 1px solid var(--border-line, #cbd5e1); color: var(--text-secondary, #475569); font-size: 0.84rem; padding: 7px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                            Not a manager? Join league as guest viewer &rarr;
                        </button>
                    </div>
                </form>
            </div>
        `;

        if (typeof accountModal.showModal === 'function' && !accountModal.open) {
            accountModal.showModal();
        }

        document.getElementById('claim-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selected = document.querySelector('input[name="manager_id"]:checked');
            if (!selected) {
                alert("Please select a manager profile to claim.");
                return;
            }

            const btn = e.target.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Linking Profile...'; }

            const finalRes = await window.AuthEngine.finalizeJoin(code, selected.value);
            if (finalRes.success) {
                if (typeof window.AuthEngine.recordActiveLeague === 'function') {
                    window.AuthEngine.recordActiveLeague(league.leagueId);
                }
                accountModal.close();
                const targetPath = typeof window.AuthEngine.resolveLeaguePath === 'function'
                    ? window.AuthEngine.resolveLeaguePath(league.leagueId)
                    : (league.path || `/${league.leagueId}`);
                
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.location.href = targetPath;
                }
            } else {
                if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Join League →'; }
                alert(finalRes.message || "Failed to complete join.");
            }
        });

        document.getElementById('btn-join-as-guest')?.addEventListener('click', async () => {
            const leagueId = league.leagueId || league.id || app?.leagueSlug;
            const resGuest = await window.AuthEngine.joinAsGuest(leagueId);
            if (resGuest.success) {
                if (typeof window.AuthEngine.recordActiveLeague === 'function') {
                    window.AuthEngine.recordActiveLeague(leagueId);
                }
                accountModal.close();
                const targetPath = typeof window.AuthEngine.resolveLeaguePath === 'function'
                    ? window.AuthEngine.resolveLeaguePath(leagueId)
                    : (league.path || `/${leagueId}`);
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.location.href = targetPath;
                }
            } else {
                alert(resGuest.message || "Could not join as guest.");
            }
        });
    };

    // ==========================================
    // ACCOUNT MODAL (Clean Light-Themed Dashboard)
    // ==========================================
    window.renderAccountModal = function() {
        if (typeof window.AuthEngine === 'undefined') return;
        const session = window.AuthEngine.getSession();
        
        if (!session) {
            accountModalContent.innerHTML = `
                <div style="text-align: center; padding: 1.5rem 0;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.3); color: var(--accent-gold, #b45309); font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">TFV</div>
                    <h3 class="modal-title" style="margin-bottom: 0.5rem; color: #0f172a;">Sign In to Fantasy Vault</h3>
                    <p style="margin-bottom: 1.5rem; color: var(--text-muted, #64748b); font-size: 0.9rem;">Access your leagues, admin tools, and manager profile.</p>
                    <button id="btn-account-signin" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem;">Sign In / Register &rarr;</button>
                </div>
            `;
            const btnSignin = document.getElementById('btn-account-signin');
            if (btnSignin) {
                btnSignin.addEventListener('click', () => {
                    accountModal.close();
                    const authModal = document.getElementById('auth-modal');
                    if (authModal && typeof authModal.showModal === 'function') {
                        authModal.showModal();
                    } else {
                        window.location.href = '/';
                    }
                });
            }
            return;
        }

        const app = window.app || window.appInstance;
        const rawPathSlug = window.location.pathname.replace(/^\/|\/$/g, '') || '';
        const activeSlug = app?.leagueSlug || rawPathSlug || '';
        
        let joinedList = Array.isArray(session.joinedLeagues) ? [...session.joinedLeagues] : [];
        if (activeSlug && activeSlug !== 'vault' && activeSlug !== 'index.html' && !joinedList.includes(activeSlug)) {
            joinedList.push(activeSlug);
            session.joinedLeagues = joinedList;
        }

        let leaguesListHTML = '';
        if (joinedList.length > 0) {
            leaguesListHTML = joinedList.map(leagueId => {
                const info = typeof JOIN_CODES !== 'undefined' ? Object.values(JOIN_CODES).find(l => l.leagueId === leagueId) : null;
                const cachedDetails = session.leagueDetails ? session.leagueDetails[leagueId] : null;
                const localStoredName = localStorage.getItem(`vault_league_name_${leagueId}`);
                
                let name = (cachedDetails && cachedDetails.name) ||
                           (info && info.name) ||
                           (app?.leagueSlug === leagueId ? app?.leagueSettings?.name : null) ||
                           localStoredName ||
                           (leagueId === 'fbofantasy' ? 'FBO Fantasy League' : (leagueId.charAt(0).toUpperCase() + leagueId.slice(1) + ' League'));
                
                const path = (cachedDetails && cachedDetails.path) || (info ? info.path : `/${leagueId}`);
                const isUserAdmin = Boolean(session.isFounder || (session.adminLeagues && session.adminLeagues.includes(leagueId)));
                const isCurrent = (activeSlug === leagueId) || (activeSlug === '' && leagueId === 'vault');
                
                const storedClaim = localStorage.getItem(`vault_claim_${leagueId}`);
                let claimId = (session.claims && session.claims[leagueId]) || storedClaim || null;
                
                // If on active league page or claims in app instance, check app.claims
                if (!claimId && app && (app.leagueSlug === leagueId || (leagueId === 'dmsfantasy' && window.location.pathname.includes('dmsfantasy')) || (leagueId === 'gaywoodfantasy' && window.location.pathname.includes('gaywoodfantasy')))) {
                    if (app.claims) {
                        const matchedClaim = Object.entries(app.claims).find(([k, v]) => v?.email === session.email || (session.uid && v?.userId === session.uid));
                        if (matchedClaim) {
                            claimId = matchedClaim[0];
                            if (!session.claims) session.claims = {};
                            session.claims[leagueId] = claimId;
                            try { localStorage.setItem(`vault_claim_${leagueId}`, claimId); } catch(e){}
                        }
                    }
                }

                let mgr = null;
                if (claimId) {
                    if (app && (app.leagueSlug === leagueId || (leagueId === 'dmsfantasy' && window.location.pathname.includes('dmsfantasy')) || (leagueId === 'gaywoodfantasy' && window.location.pathname.includes('gaywoodfantasy')))) {
                        mgr = (app?.members ? app.members.find(m => String(m.id).toLowerCase() === String(claimId).toLowerCase() || String(m.espn_id) === String(claimId)) : null) ||
                              (app?.managers ? app.managers.find(m => String(m.id).toLowerCase() === String(claimId).toLowerCase() || String(m.espn_id) === String(claimId)) : null);
                    }
                    if (!mgr && info && info.managers) {
                        mgr = info.managers.find(m => String(m.id).toLowerCase() === String(claimId).toLowerCase() || String(m.espn_id) === String(claimId));
                    }
                    if (!mgr && typeof JOIN_CODES !== 'undefined') {
                        if (leagueId === 'dmsfantasy' && JOIN_CODES['DNFUAM']?.managers) {
                            mgr = JOIN_CODES['DNFUAM'].managers.find(m => String(m.id).toLowerCase() === String(claimId).toLowerCase());
                        }
                        if (leagueId === 'gaywoodfantasy' && JOIN_CODES['Y6CW7J']?.managers) {
                            mgr = JOIN_CODES['Y6CW7J'].managers.find(m => String(m.id).toLowerCase() === String(claimId).toLowerCase() || String(m.espn_id) === String(claimId));
                        }
                    }
                }

                const mgrBaseName = mgr?.canonical_name || mgr?.name || (claimId ? (session.name || 'Manager') : '');
                const mgrNickname = mgr?.nickname || (session.managerNicknames && session.managerNicknames[leagueId]) || '';
                const allowNick = (app?.leagueSlug === leagueId && app?.leagueSettings?.allow_nicknames !== false) || true;
                const previewName = claimId ? formatManagerDisplayName(mgrBaseName, mgrNickname, allowNick) : '';

                return `
                    <li style="margin-bottom: 0.85rem; padding: 0.85rem; background: var(--bg-card-alt, #f8fafc); border: 1px solid var(--border-line, #e2e8f0); border-radius: 8px; box-sizing: border-box;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                ${isCurrent 
                                    ? `<span style="color: var(--accent-gold, #b45309); font-weight: 700; font-size: 0.95rem;">${name}</span>`
                                    : `<a href="${path}" style="color: var(--text-primary, #0f172a); text-decoration: none; font-weight: 600; font-size: 0.95rem;">${name}</a>`
                                }
                                ${isUserAdmin ? '<span style="display:inline-block; background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.35); color:#b45309; font-size:0.65rem; font-weight:700; padding:1px 6px; border-radius:6px; text-transform:uppercase; letter-spacing:0.5px;">Admin</span>' : ''}
                            </div>
                            <div>
                                ${isCurrent 
                                    ? `<span style="font-size: 0.72rem; padding: 2px 7px; background: #e0f2fe; color: #0284c7; border-radius: 4px; font-weight: 600;">Current Vault</span>`
                                    : `<a href="${path}" class="btn-primary" style="font-size: 0.78rem; padding: 4px 10px; text-decoration: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">Open &rarr;</a>`
                                }
                            </div>
                        </div>

                        <!-- Linked Member Profile & Nickname Customization -->
                        <div style="margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid var(--border-line, #e2e8f0);">
                            ${claimId ? `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Linked Profile:</span>
                                    <span style="font-size: 0.86rem; font-weight: 700; color: var(--text-primary, #0f172a);">${mgrBaseName}</span>
                                </div>
                                <div style="background: #ffffff; border: 1px solid var(--border-line, #cbd5e1); border-radius: 6px; padding: 0.6rem 0.75rem;">
                                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary, #475569); margin-bottom: 4px;">Change Nickname:</div>
                                    <div style="display: flex; gap: 6px; align-items: center;">
                                        <input type="text" class="input-account-nickname" data-league-id="${leagueId}" data-manager-id="${claimId}" data-base-name="${mgrBaseName}" value="${mgrNickname}" maxlength="20" placeholder="e.g. The Commish" style="flex: 1; padding: 5px 8px; font-size: 0.84rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px; box-sizing: border-box;">
                                        <button class="btn-save-account-nickname btn btn-sm btn-primary" data-league-id="${leagueId}" data-manager-id="${claimId}" style="padding: 5px 12px; font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; border-radius: 4px;">Save</button>
                                    </div>
                                    <div class="account-nickname-preview" data-league-id="${leagueId}" style="font-size: 0.8rem; color: var(--accent-gold, #b45309); font-weight: 700; margin-top: 5px;">
                                        Display: <span>${previewName}</span>
                                    </div>
                                    <div class="account-nickname-feedback" data-league-id="${leagueId}" style="display: none; font-size: 0.78rem; margin-top: 4px; color: #15803d; font-weight: 600;"></div>
                                </div>
                            ` : `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
                                    <span style="font-size: 0.78rem; color: var(--text-muted, #64748b);">Linked Profile: <em style="color: #94a3b8;">Unlinked</em></span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted, #64748b);">Join via league code to claim your team</span>
                                </div>
                            `}
                        </div>
                    </li>
                `;
            }).join('');
        } else {
            leaguesListHTML = '<p style="color: var(--text-muted, #64748b); font-size: 0.9rem; font-style: italic; margin-bottom: 0.5rem;">No leagues joined yet.</p>';
        }

        const displayName = session.name || (session.email ? session.email.split('@')[0] : 'User');
        const userMonogram = displayName.trim().charAt(0).toUpperCase() || 'L';

        accountModalContent.innerHTML = `
            <div class="user-info" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-line, #e2e8f0);">
                <div style="width: 48px; height: 48px; min-width: 48px; border-radius: 50%; background: linear-gradient(135deg, #d4af37 0%, #92400e 100%); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem; letter-spacing: 0.5px; border: 1.5px solid rgba(255,255,255,0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    ${userMonogram}
                </div>
                <div style="flex: 1; overflow: hidden;">
                    <h3 style="margin: 0 0 2px 0; font-size: 1.25rem; font-family: var(--font-heading, 'Cinzel', serif); font-weight: 700; color: var(--text-primary, #0f172a);">${displayName}</h3>
                    <div style="font-size: 0.82rem; color: var(--text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${session.email || ''}</div>
                </div>
            </div>

            <div class="joined-leagues" style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <h4 style="margin: 0; font-family: var(--font-heading, 'Cinzel', serif); font-size: 1rem; color: var(--accent-gold, #b45309);">Your Leagues</h4>
                    <span style="font-size: 0.8rem; color: var(--text-muted, #64748b);">${joinedList.length} ${joinedList.length === 1 ? 'league' : 'leagues'}</span>
                </div>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${leaguesListHTML}
                </ul>
            </div>

            <div class="add-league" style="margin-bottom: 1.25rem; background: var(--bg-card-alt, #f8fafc); padding: 1rem; border-radius: 6px; border: 1px solid var(--border-line, #e2e8f0);">
                <h4 style="margin-top: 0; margin-bottom: 0.5rem; font-family: var(--font-heading, 'Cinzel', serif); font-size: 0.95rem; color: var(--text-primary, #0f172a);">Join Another League</h4>
                <form id="account-join-form" style="display: flex; gap: 0.5rem;">
                    <input type="text" id="account-join-code" placeholder="Enter 6-char Code" maxlength="6" required style="flex: 1; padding: 0.55rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px; background: #fff; color: #0f172a; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">
                    <button type="submit" class="btn-primary" style="padding: 0.55rem 1.25rem; font-weight: 600; cursor: pointer;">Join</button>
                </form>
            </div>

            <div class="import-league-section" style="margin-bottom: 1.5rem; background: #fffbeb; padding: 1.1rem; border-radius: 6px; border: 1px dashed #d97706;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                    <h4 style="margin: 0; font-family: var(--font-heading, 'Cinzel', serif); font-size: 0.95rem; color: #b45309;">Import a New League</h4>
                    <span style="font-size: 0.68rem; font-weight: 700; color: #15803d; background: #dcfce7; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Free 1-Mo Trial</span>
                </div>
                <p style="font-size: 0.82rem; color: #475569; margin-bottom: 0.85rem; line-height: 1.4;">Connect your ESPN, Yahoo, or Sleeper league. Free 30-day trial included for all newly imported leagues ($19.99/yr thereafter).</p>
                <button id="btn-account-import-league" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem; font-weight: 600; cursor: pointer;">
                    + Import a New League
                </button>
            </div>

            <div style="text-align: right; margin-top: 1rem; border-top: 1px solid var(--border-line, #e2e8f0); padding-top: 1rem;">
                <button id="btn-account-logout" style="background: none; border: 1px solid var(--border-line, #cbd5e1); color: var(--text-muted, #64748b); padding: 0.4rem 0.85rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;">Sign Out</button>
            </div>
        `;

        // Wire live input preview on account nicknames
        accountModalContent.querySelectorAll('.input-account-nickname').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const leagueId = inp.getAttribute('data-league-id');
                const baseName = inp.getAttribute('data-base-name') || '';
                const previewEl = accountModalContent.querySelector(`.account-nickname-preview[data-league-id="${leagueId}"] span`);
                if (previewEl) {
                    const allowNick = (app?.leagueSlug === leagueId && app?.leagueSettings?.allow_nicknames !== false) || true;
                    previewEl.textContent = formatManagerDisplayName(baseName, inp.value.trim(), allowNick);
                }
            });
        });

        // Wire save nickname buttons in account modal
        accountModalContent.querySelectorAll('.btn-save-account-nickname').forEach(btn => {
            btn.addEventListener('click', async () => {
                const leagueId = btn.getAttribute('data-league-id');
                const managerId = btn.getAttribute('data-manager-id');
                const inp = accountModalContent.querySelector(`.input-account-nickname[data-league-id="${leagueId}"]`);
                const feedbackEl = accountModalContent.querySelector(`.account-nickname-feedback[data-league-id="${leagueId}"]`);
                if (!inp || !managerId) return;

                const newNick = inp.value.trim().slice(0, 20);
                const orig = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Saving...';

                try {
                    // 1. Update Firebase RTDB claims
                    const claimRef = dbRef(database, `leagues/${leagueId}/claims/${managerId}`);
                    await update(claimRef, { nickname: newNick }).catch(() => {});

                    // 2. If app is currently active for this league, update in-memory
                    if (app && (app.leagueSlug === leagueId || (leagueId === 'dmsfantasy' && window.location.pathname.includes('dmsfantasy')) || (leagueId === 'gaywoodfantasy' && window.location.pathname.includes('gaywoodfantasy')))) {
                        if (app.claims) {
                            app.claims[managerId] = { ...(app.claims[managerId] || {}), nickname: newNick };
                        }
                        if (app.members) {
                            const m = app.members.find(x => x.id === managerId || x.espn_id === managerId || String(x.id).toLowerCase() === String(managerId).toLowerCase() || String(x.espn_id).toLowerCase() === String(managerId).toLowerCase());
                            if (m) {
                                m.nickname = newNick;
                                if (app.claims) app.claims[m.id] = { ...(app.claims[m.id] || {}), nickname: newNick };
                            }
                            const allMemRef = dbRef(database, `leagues/${leagueId}/members`);
                            await set(allMemRef, app.members).catch(() => {});
                        }
                        if (app.managers) {
                            const m = app.managers.find(x => x.id === managerId || x.espn_id === managerId || String(x.id).toLowerCase() === String(managerId).toLowerCase() || String(x.espn_id).toLowerCase() === String(managerId).toLowerCase());
                            if (m) {
                                m.nickname = newNick;
                                if (app.claims) app.claims[m.id] = { ...(app.claims[m.id] || {}), nickname: newNick };
                            }
                            const allMgrRef = dbRef(database, `leagues/${leagueId}/managers`);
                            await set(allMgrRef, app.managers).catch(() => {});
                        }

                        // Re-render views immediately across power rankings, h2h, records, draft, and rivalries
                        app.initPowerRankings?.();
                        app.setupH2HControls?.();
                        app.renderH2H?.();
                        app.renderRecords?.();
                        app.renderRecordBook?.();
                        app.renderRivalryWeek?.();
                        if (app.draftEngine) {
                            app.draftEngine.updateData({
                                managers: app.managers || app.members,
                                draftResults: app.draftResults,
                                leagueSettings: app.leagueSettings,
                                scoringSettings: app.scoringSettings || app.leagueSettings
                            });
                            if (app.activeTab === 'draft' || app.activeTab === 'draft-hub') {
                                app.draftEngine.render();
                            }
                        }
                        if (app.activeTab === 'admin') {
                            app.renderAdminDashboard?.();
                        }
                    }

                    // 3. Dispatch global event for multi-component synchronization
                    window.dispatchEvent(new CustomEvent('vault_nickname_updated', {
                        detail: { leagueId, managerId, nickname: newNick }
                    }));

                    // 4. Update session cache
                    if (!session.managerNicknames) session.managerNicknames = {};
                    session.managerNicknames[leagueId] = newNick;
                    try {
                        localStorage.setItem('vault_cached_session', JSON.stringify(session));
                        sessionStorage.setItem('vault_auth_session', JSON.stringify(session));
                    } catch (e) {}

                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.style.color = '#15803d';
                        feedbackEl.textContent = newNick ? `✓ Nickname saved as "${newNick}"!` : `✓ Nickname cleared!`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                } catch (e) {
                    console.error('Failed to save nickname from account', e);
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.style.color = '#dc2626';
                        feedbackEl.textContent = 'Error saving nickname. Please try again.';
                    }
                } finally {
                    btn.disabled = false;
                    btn.textContent = orig;
                }
            });
        });

        // Join code form submission
        const joinForm = document.getElementById('account-join-form');
        if (joinForm) {
            joinForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const codeInput = document.getElementById('account-join-code');
                const code = codeInput.value.trim().toUpperCase();
                window.startManagerClaimFlow(code);
            });
        }

        // Import league button handler
        const btnImportLeague = document.getElementById('btn-account-import-league');
        if (btnImportLeague) {
            btnImportLeague.addEventListener('click', (e) => {
                e.preventDefault();
                accountModal.close();
                window.openImportLeagueModal();
            });
        }

        // Logout button handler
        const btnLogout = document.getElementById('btn-account-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                accountModal.close();
                window.AuthEngine.logout();
            });
        }
    };

    // ==========================================
    // UNIVERSAL IN-PLACE LEAGUE IMPORT WIZARD (Clean Light Theme)
    // ==========================================
    window.openImportLeagueModal = function() {
        let importModal = document.getElementById('universal-import-modal');
        if (!importModal) {
            importModal = document.createElement('dialog');
            importModal.id = 'universal-import-modal';
            importModal.className = 'modal';
            importModal.style.maxWidth = '620px';
            importModal.style.width = '92%';
            importModal.style.background = '#ffffff';
            importModal.style.color = '#0f172a';
            importModal.style.border = '1px solid #e2e8f0';
            importModal.style.borderRadius = '12px';
            importModal.style.padding = '1.75rem';
            importModal.style.boxShadow = '0 25px 60px rgba(0,0,0,0.15)';
            importModal.style.position = 'fixed';
            importModal.style.top = '50%';
            importModal.style.left = '50%';
            importModal.style.transform = 'translate(-50%, -50%)';
            importModal.style.margin = '0';
            document.body.appendChild(importModal);
        } else {
            importModal.style.background = '#ffffff';
            importModal.style.color = '#0f172a';
            importModal.style.border = '1px solid #e2e8f0';
        }

        let fetchedLeagueData = null;

        const renderStep1 = () => {
            importModal.innerHTML = `
                <button id="close-universal-import-modal" class="modal-close-x" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; color: #64748b; cursor: pointer;">&times;</button>
                
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.25rem;">
                    <h3 class="modal-title" style="font-family: var(--font-heading, 'Cinzel', serif); color: #b45309; margin: 0; font-size: 1.4rem;">Import a New League</h3>
                    <span style="font-size: 0.68rem; font-weight: 700; color: #15803d; background: #dcfce7; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">1-Month Free Trial</span>
                </div>
                <p style="color: #64748b; font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.4;">
                    Enter your fantasy platform details to discover historical seasons and generate a dedicated archive. All new imports include a 30-day free trial ($19.99/year per league after trial).
                </p>
                
                <form id="universal-import-form">
                    <div style="margin-bottom: 1rem;">
                        <label class="form-label" style="display: block; font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 0.35rem;">League Name</label>
                        <input type="text" id="u-import-name" required placeholder="e.g. Ironclad Dynasty League" class="form-input" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; box-sizing: border-box;">
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.35rem;">
                            Your vault URL: <strong style="color: #b45309; font-family: monospace;">thefantasyvault.com/<span id="u-import-slug-preview">league</span></strong>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                        <div>
                            <label class="form-label" style="display: block; font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 0.35rem;">Platform</label>
                            <select id="u-import-platform" class="form-input" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; box-sizing: border-box;">
                                <option value="espn" selected>ESPN Fantasy</option>
                                <option value="yahoo" disabled>Yahoo Fantasy (Coming Soon)</option>
                                <option value="sleeper" disabled>Sleeper (Coming Soon)</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label" style="display: block; font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 0.35rem;">Privacy Setting</label>
                            <select id="u-import-privacy" class="form-input" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; box-sizing: border-box;">
                                <option value="public" selected>Public (Link Access)</option>
                                <option value="private">Private (Invite / SSO Guarded)</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <label class="form-label" style="display: block; font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 0.35rem;">ESPN League ID</label>
                        <input type="text" id="u-import-league-id" required placeholder="e.g. 12345678" class="form-input" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; box-sizing: border-box;">
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.35rem;">Found in your league's browser URL (e.g. <code>leagueId=12345678</code>).</div>
                    </div>

                    <div id="u-espn-private-box" style="display: none; margin-bottom: 1.25rem; padding: 1.15rem; background: rgba(251, 188, 5, 0.05); border-radius: 8px; border: 1px solid var(--border-gold, #fde047);">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 0.5rem; flex-wrap: wrap;">
                            <h4 style="margin: 0; color: var(--accent-gold, #854d0e); font-size: 0.92rem;">Private ESPN Authentication</h4>
                            <a href="https://fantasy.espn.com" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; font-weight: 600; color: var(--accent-gold, #b45309); text-decoration: underline;">
                                Open ESPN Fantasy &nearr;
                            </a>
                        </div>
                        <p style="font-size: 0.8rem; color: var(--text-muted, #713f12); margin-bottom: 0.85rem; line-height: 1.45;">
                            Private ESPN leagues require your temporary <code>espn_s2</code> and <code>SWID</code> cookies for historical import. Credentials are never stored.
                        </p>

                        <!-- Quick 1-Click Helper Bar -->
                        <div style="background: rgba(0, 0, 0, 0.04); border: 1px dashed var(--border-gold, #fde047); border-radius: 6px; padding: 0.85rem 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-size: 0.78rem; font-weight: 700; color: var(--accent-gold, #854d0e); text-transform: uppercase; letter-spacing: 0.5px;">1-Click Bookmark Helper:</div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                <a href="javascript:(function(){var c=document.cookie;var s2=(c.match(/espn_s2=([^;]+)/)||[])[1];var sw=(c.match(/SWID=([^;]+)/i)||[])[1];if(s2&amp;&amp;sw){navigator.clipboard.writeText('espn_s2: '+s2+'\nSWID: '+sw).then(function(){alert('ESPN credentials copied to clipboard! Switch back to The Fantasy Vault and paste them.');});}else{alert('Could not find ESPN cookies. Make sure you are logged into fantasy.espn.com.');}})();" 
                                   title="Drag to your Bookmarks Bar"
                                   style="background: var(--accent-gold, #b45309); color: #fff; font-size: 0.78rem; font-weight: 700; padding: 6px 12px; border-radius: 4px; text-decoration: none; cursor: grab; display: inline-flex; align-items: center; gap: 6px;">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block;"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                                  Get ESPN Cookies (Drag to Bookmarks)
                                </a>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); line-height: 1.45;">
                                <strong>Instructions:</strong>
                                <ol style="margin: 4px 0 0 0; padding-left: 1.2rem; line-height: 1.5;">
                                    <li>Drag the gold button above into your browser Bookmarks Bar (press <code>Cmd+Shift+B</code> or <code>Ctrl+Shift+B</code> if your bookmarks bar is hidden).</li>
                                    <li>In a browser tab, open <a href="https://fantasy.espn.com" target="_blank" rel="noopener" style="color: var(--accent-gold, #b45309); text-decoration: underline;">fantasy.espn.com</a> and make sure you are logged in.</li>
                                    <li>With your ESPN fantasy tab active and currently open, click this bookmark from your bookmarks bar, as it will instantly copy your credentials to your clipboard.</li>
                                    <li>Return here and paste into either field below. Smart auto-detect will automatically split and fill both credentials.</li>
                                </ol>
                            </div>
                        </div>

                        <div style="margin-bottom: 0.65rem;">
                            <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--accent-gold, #854d0e); margin-bottom: 0.25rem;">ESPN s2 Cookie</label>
                            <input type="text" id="u-import-s2" placeholder="Paste s2 cookie (e.g. AECsRJF...)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px; background: #fff; color: #0f172a; font-family: monospace; font-size: 0.8rem; box-sizing: border-box;">
                        </div>
                        <div style="margin-bottom: 0.75rem;">
                            <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--accent-gold, #854d0e); margin-bottom: 0.25rem;">ESPN SWID</label>
                            <input type="text" id="u-import-swid" placeholder="Paste SWID (e.g. {1234-5678-ABCD})" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-line, #cbd5e1); border-radius: 4px; background: #fff; color: #0f172a; font-family: monospace; font-size: 0.8rem; box-sizing: border-box;">
                        </div>
                        <details style="font-size: 0.78rem; color: var(--text-muted, #713f12);">
                            <summary style="cursor: pointer; color: var(--accent-gold, #b45309); font-weight: 600;">Manual Developer Tools Guide</summary>
                            <ol style="margin-top: 0.5rem; padding-left: 1.2rem; line-height: 1.5;">
                                <li>Log into your ESPN league on desktop at <a href="https://fantasy.espn.com" target="_blank" rel="noopener" style="color: var(--accent-gold, #b45309);">fantasy.espn.com</a>.</li>
                                <li>Right-click anywhere and select <strong>Inspect</strong> (or press <code>F12</code>).</li>
                                <li>Open <strong>Application</strong> &rarr; <strong>Cookies</strong> &rarr; <code>https://fantasy.espn.com</code>.</li>
                                <li>Copy the values for <code>espn_s2</code> and <code>swid</code> into the fields above.</li>
                            </ol>
                        </details>
                    </div>

                    <button type="submit" id="btn-u-import-fetch" class="btn-primary" style="width: 100%; justify-content: center; padding: 0.75rem; font-size: 0.95rem; font-weight: 600; cursor: pointer;">
                        Connect &amp; Fetch League Data &rarr;
                    </button>
                </form>
            `;

            // Close button
            document.getElementById('close-universal-import-modal')?.addEventListener('click', () => {
                importModal.close();
            });

            // Dynamic slug preview
            const nameInput = document.getElementById('u-import-name');
            const slugPreview = document.getElementById('u-import-slug-preview');
            if (nameInput && slugPreview) {
                nameInput.addEventListener('input', () => {
                    const slug = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'league';
                    slugPreview.textContent = slug;
                });
            }

            // Privacy toggle
            const privacySelect = document.getElementById('u-import-privacy');
            const espnPrivateBox = document.getElementById('u-espn-private-box');
            if (privacySelect && espnPrivateBox) {
                privacySelect.addEventListener('change', () => {
                    espnPrivateBox.style.display = privacySelect.value === 'private' ? 'block' : 'none';
                });
            }

            // Smart ESPN Paste for Universal Importer
            const uS2 = document.getElementById('u-import-s2');
            const uSwid = document.getElementById('u-import-swid');
            const handleUPaste = (e) => {
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
                if (foundS2 && uS2) uS2.value = foundS2;
                if (foundSwid && uSwid) uSwid.value = foundSwid;
            };
            if (uS2) {
                uS2.addEventListener('paste', handleUPaste);
                uS2.addEventListener('input', (e) => {
                    if (e.target.value.includes('SWID') || e.target.value.includes('espn_s2') || e.target.value.includes('{')) handleUPaste({ target: e.target });
                });
            }
            if (uSwid) {
                uSwid.addEventListener('paste', handleUPaste);
                uSwid.addEventListener('input', (e) => {
                    if (e.target.value.includes('SWID') || e.target.value.includes('espn_s2') || e.target.value.includes('{')) handleUPaste({ target: e.target });
                });
            }

            // Form Submit -> Fetch ESPN Data
            const form = document.getElementById('universal-import-form');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const rawName = nameInput.value.trim();
                    const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const leagueId = document.getElementById('u-import-league-id').value.trim();
                    const privacy = privacySelect.value;
                    const s2 = document.getElementById('u-import-s2')?.value.trim() || '';
                    const swid = document.getElementById('u-import-swid')?.value.trim() || '';

                    if (!slug) {
                        alert("Please enter a valid league name.");
                        return;
                    }
                    if (!leagueId) {
                        alert("Please enter a valid ESPN League ID.");
                        return;
                    }

                    // Loading screen
                    renderLoading("Connecting to ESPN & discovering historical seasons...");

                    try {
                        const url = `/api/espn?leagueId=${encodeURIComponent(leagueId)}&s2=${encodeURIComponent(s2)}&swid=${encodeURIComponent(swid)}`;
                        const res = await fetch(url);
                        const json = await res.json();

                        if (!res.ok) {
                            throw new Error(json.error || "Failed to fetch league data from ESPN.");
                        }

                        fetchedLeagueData = {
                            rawName,
                            slug,
                            leagueId,
                            privacy,
                            s2,
                            swid,
                            espnData: json
                        };

                        renderStep2();
                    } catch (err) {
                        alert("Fetch Failed: " + err.message);
                        renderStep1();
                    }
                });
            }
        };

        const renderLoading = (msg) => {
            importModal.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <div class="spinner" style="margin: 0 auto 1.5rem auto; border: 4px solid rgba(212,175,55,0.2); border-top-color: var(--accent-gold, #b45309); border-radius: 50%; width: 44px; height: 44px; animation: spin 1s linear infinite;"></div>
                    <h3 class="modal-title" style="font-family: var(--font-heading, 'Cinzel', serif); color: #b45309; margin-bottom: 0.5rem; font-size: 1.3rem;">Syncing League Records</h3>
                    <p style="color: #64748b; font-size: 0.9rem;">${msg}</p>
                </div>
            `;
        };

        const renderStep2 = () => {
            const data = fetchedLeagueData.espnData;
            const members = data.members || [];
            
            const activeMembers = members.filter(m => m.isActive);
            const inactiveMembers = members.filter(m => !m.isActive);

            const activeHtml = activeMembers.map((m) => {
                const idx = members.indexOf(m);
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.65rem 0.85rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                            <input type="checkbox" class="u-mgr-chk" data-index="${idx}" checked style="cursor: pointer; transform: scale(1.15);">
                            <div>
                                <div style="font-weight: 600; font-size: 0.9rem; color: #0f172a;">${m.name}</div>
                                <div style="font-size: 0.75rem; color: #64748b;">${m.handle ? '@' + m.handle : 'ID: ' + m.id}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="font-size: 0.75rem; color: #64748b;">Alias:</label>
                            <input type="text" class="u-mgr-alias" data-index="${idx}" value="${m.alias || m.name}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; width: 140px;">
                        </div>
                    </div>
                `;
            });

            const inactiveHtml = inactiveMembers.map((m) => {
                const idx = members.indexOf(m);
                const options = activeMembers.map(am => `<option value="${am.id}">${am.name}</option>`).join('');
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.65rem 0.85rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 0.5rem;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: #475569;">${m.name}</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Inactive / Former Manager</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="font-size: 0.75rem; color: #64748b;">Merge Target:</label>
                            <select class="u-mgr-merge" data-index="${idx}" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a;">
                                <option value="">Keep Separate</option>
                                ${options}
                            </select>
                        </div>
                    </div>
                `;
            });

            const creatorClaimOptions = activeMembers.map(am => `<option value="${am.id}">${am.name}</option>`).join('');

            importModal.innerHTML = `
                <button id="close-universal-import-modal" class="modal-close-x" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; color: #64748b; cursor: pointer;">&times;</button>
                
                <h3 class="modal-title" style="font-family: var(--font-heading, 'Cinzel', serif); color: #b45309; margin-top: 0; margin-bottom: 0.5rem; font-size: 1.35rem;">Historical Archive Discovered</h3>
                <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.4;">
                    We found <strong>${activeMembers.length} active managers</strong> and <strong>${inactiveMembers.length} historical managers</strong> across ${data.seasons ? data.seasons.length : 'all'} seasons. Confirm display aliases and merge mappings:
                </p>

                <!-- Claim Identity during setup -->
                <div style="margin-bottom: 1rem; padding: 0.85rem 1rem; background: #fefce8; border: 1px solid #fde047; border-radius: 6px;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #854d0e; margin-bottom: 0.35rem;">Claim Your Manager Profile (League Creator)</label>
                    <p style="font-size: 0.78rem; color: #713f12; margin-bottom: 0.5rem;">Select which team belongs to you so your user account is linked immediately:</p>
                    <select id="u-creator-claim" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; font-size: 0.88rem;">
                        <option value="">-- Select Which Manager You Are --</option>
                        ${creatorClaimOptions}
                    </select>
                </div>

                <div style="max-height: 280px; overflow-y: auto; margin-bottom: 1.25rem; padding-right: 0.5rem;">
                    <div style="font-size: 0.8rem; color: #b45309; font-weight: 700; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Active Managers</div>
                    ${activeHtml.join('')}
                    ${inactiveHtml.length > 0 ? `
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Historical / Inactive Managers</div>
                        ${inactiveHtml.join('')}
                    ` : ''}
                </div>

                <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 700; color: #15803d;">1-Month Free Trial Active</div>
                        <div style="font-size: 0.75rem; color: #64748b;">No credit card required today. $19.99/year per league after 30 days.</div>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: #15803d; background: #dcfce7; padding: 3px 8px; border-radius: 12px;">$0.00 DUE NOW</span>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" id="btn-u-import-back" style="flex: 1; background: none; border: 1px solid #cbd5e1; color: #64748b; padding: 0.75rem; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        &larr; Back
                    </button>
                    <button type="button" id="btn-u-import-build" class="btn-primary" style="flex: 2; justify-content: center; padding: 0.75rem; font-size: 0.95rem; font-weight: 600; cursor: pointer;">
                        Start Free Trial &amp; Build Vault &rarr;
                    </button>
                </div>
            `;

            // Close button
            document.getElementById('close-universal-import-modal')?.addEventListener('click', () => {
                importModal.close();
            });

            // Back button
            document.getElementById('btn-u-import-back')?.addEventListener('click', () => {
                renderStep1();
            });

            // Checkbox changes
            document.querySelectorAll('.u-mgr-chk').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    members[idx].isActive = e.target.checked;
                });
            });

            // Alias changes
            document.querySelectorAll('.u-mgr-alias').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    const val = e.target.value.trim();
                    if (val) members[idx].alias = val;
                });
            });

            // Merge select changes
            document.querySelectorAll('.u-mgr-merge').forEach(select => {
                select.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    members[idx].mergedInto = e.target.value;
                });
            });

            // Build Action
            document.getElementById('btn-u-import-build')?.addEventListener('click', async () => {
                const { rawName, slug, leagueId, privacy, s2, swid } = fetchedLeagueData;
                const creatorClaimId = document.getElementById('u-creator-claim')?.value || '';

                const pendingBuildPayload = {
                    leagueId: leagueId,
                    s2: s2,
                    swid: swid,
                    customName: rawName,
                    isPrivate: privacy === 'private',
                    members: members,
                    creatorClaimId: creatorClaimId
                };

                sessionStorage.setItem('pendingVaultBuild', JSON.stringify(pendingBuildPayload));
                
                // Immediately navigate to the new league page with building flag
                window.location.href = '/' + slug + '?building=true';
            });
        };

        renderStep1();
        if (typeof importModal.showModal === 'function') {
            importModal.showModal();
        }
    };

    // Modal open / close triggers
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

    function updateAccountButtonUI() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (!btnMyAccount) return;
        if (session) {
            const displayName = session.name || (session.email ? session.email.split('@')[0] : 'User');
            const monogram = displayName.trim().charAt(0).toUpperCase() || 'L';
            btnMyAccount.innerHTML = `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg, #d4af37 0%, #b45309 100%); color:#fff; font-weight:800; font-size:0.72rem; margin-right:6px; box-shadow:0 1px 3px rgba(0,0,0,0.15);">${monogram}</span> <span style="font-weight:600;">My Account</span>`;
            btnMyAccount.title = `${displayName} (${session.email || ''})`;
        } else {
            btnMyAccount.innerHTML = `<span style="font-weight:600;">Sign In</span>`;
            btnMyAccount.title = 'Sign In to Fantasy Vault';
        }
    }

    // Check URL parameters for direct claim or admin transfer actions
    function checkUrlActions() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const pathSlug = window.location.pathname.replace(/^\/|\/$/g, '') || '';

        if (action === 'claim_manager') {
            const managerId = urlParams.get('manager');
            if (managerId && pathSlug) {
                setTimeout(() => {
                    window.startDirectManagerClaim(pathSlug, managerId);
                }, 300);
            }
        } else if (action === 'transfer_admin') {
            const league = urlParams.get('league') || pathSlug;
            if (league) {
                setTimeout(() => {
                    window.startAdminTransferFlow(league);
                }, 300);
            }
        }
    }

    // Listen for auth state changes
    window.addEventListener('vault_auth_changed', () => {
        updateAccountButtonUI();
    });

    // Initial button render & URL check
    updateAccountButtonUI();
    checkUrlActions();
})();
