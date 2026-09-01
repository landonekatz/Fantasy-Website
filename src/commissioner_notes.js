// The Fantasy Vault - Unified Commissioner Notes & League Updates Engine
import { database } from './firebase.js';
import { ref as dbRef, set, get, onValue } from 'firebase/database';

function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
}

export class CommissionerNotesEngine {
    constructor(options = {}) {
        this.leagueSlug = options.leagueSlug || 'dmsfantasy';
        this.app = options.app || null;
        this.currentIndex = 0; // 0 = current live note, 1+ = archived notes
        this.containerId = options.containerId || 'commissioner-note';
        this.scrollerPillId = options.scrollerPillId || 'scroller-pill-notes';
        this.adminContainerId = options.adminContainerId || 'admin-sec-notes-content';

        // Default note data if none exists in RTDB
        const defaultTitle = this.leagueSlug === 'dmsfantasy' ? 'League Updates' : 'Note from the Commissioner';
        const defaultHeadline = this.leagueSlug === 'dmsfantasy' ? 'Personnel Changes' : (this.leagueSlug === 'gaywoodfantasy' ? 'Welcome to the 2025 Season' : 'Welcome to the Archive');
        const defaultBody = this.leagueSlug === 'dmsfantasy'
            ? "The whole league was distraught to learn of perennial loser Jack Lovas's removal. It was not due to their love of Lovas - but the loss of a free win one could pencil in their schedule.\n\nLovas's replacement, Madoc Watson, passed the Commissioner and Committee's physical and mental examinations and will debut in the opening week of the 2026 season. Watson is known for his delusional self-belief and scrappy playstyle and projects as a bottom-to-middle level contender."
            : (this.leagueSlug === 'gaywoodfantasy'
                ? "Welcome to another year of Gaywood / Katz Fantasy Football. Since 2015, this league has been the proving ground for glory and heartbreak. Good luck to all managers this season."
                : "Welcome to our official league archive. All historical matchups, draft selections, records, and league updates are preserved here.");

        this.data = {
            section_title: defaultTitle,
            allowed_editors: [],
            current_note: {
                id: `note_init_${this.leagueSlug}`,
                title: defaultHeadline,
                content: defaultBody,
                author_name: 'Commissioner',
                author_email: '',
                created_at: 1725184000000,
                updated_at: 1725184000000,
                last_edited_by: 'Commissioner'
            },
            archived_notes: []
        };

        this.isLoaded = false;
        this.init();
    }

    async init() {
        if (!database) {
            this.isLoaded = true;
            this.render();
            return;
        }

        try {
            const notesRef = dbRef(database, `leagues/${this.leagueSlug}/commissioner_notes`);
            
            // Initial fetch
            const snap = await get(notesRef).catch(() => null);
            if (snap && snap.exists()) {
                const val = snap.val();
                this.mergeData(val);
            }

            // Real-time synchronization
            onValue(notesRef, (snapshot) => {
                if (snapshot.exists()) {
                    this.mergeData(snapshot.val());
                    this.render();
                    this.renderAdminSection();
                }
            });
        } catch (e) {
            console.warn('CommissionerNotesEngine init warning:', e);
        }

        this.isLoaded = true;
        this.render();
        this.renderAdminSection();

        // Listen for auth changes to update editor button visibility
        window.addEventListener('vault_auth_changed', () => {
            this.render();
            this.renderAdminSection();
        });
    }

    mergeData(val) {
        if (!val || typeof val !== 'object') return;
        if (val.section_title) this.data.section_title = val.section_title;
        if (Array.isArray(val.allowed_editors)) {
            this.data.allowed_editors = val.allowed_editors;
        } else if (val.allowed_editors && typeof val.allowed_editors === 'object') {
            this.data.allowed_editors = Object.values(val.allowed_editors);
        }
        if (val.current_note) this.data.current_note = val.current_note;
        if (Array.isArray(val.archived_notes)) {
            this.data.archived_notes = val.archived_notes;
        } else if (val.archived_notes && typeof val.archived_notes === 'object') {
            this.data.archived_notes = Object.values(val.archived_notes);
        }
    }

    canEdit() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (!session) return false;
        if (session.isFounder || session.email === 'landonekatz@gmail.com') return true;

        // Check if user is league admin
        const isAdmin = Boolean(
            (session.adminLeagues && (session.adminLeagues.includes(this.leagueSlug) || (this.leagueSlug === 'dmsfantasy' && session.adminLeagues.includes('dms')))) ||
            (this.app?.leagueSettings?.admin_email && session.email && this.app.leagueSettings.admin_email.toLowerCase() === session.email.toLowerCase())
        );
        if (isAdmin) return true;

        const allowed = this.data.allowed_editors || [];
        if (allowed.length === 0) return false;

        // Check email match
        const userEmail = (session.email || '').toLowerCase();
        if (userEmail && allowed.some(e => String(e).toLowerCase() === userEmail)) return true;

        // Check user ID match
        if (session.uid && allowed.some(e => String(e) === String(session.uid))) return true;

        // Check claimed manager ID in this league
        const userClaim = session.claims?.[this.leagueSlug] || (this.app?.claims && Object.entries(this.app.claims).find(([k, v]) => v?.email && session.email && v.email.toLowerCase() === session.email.toLowerCase())?.[0]);
        if (userClaim && allowed.some(e => String(e).toLowerCase() === String(userClaim).toLowerCase())) {
            return true;
        }

        return false;
    }

    getAllNotes() {
        const list = [];
        if (this.data.current_note) {
            list.push({ ...this.data.current_note, _isLive: true });
        }
        if (Array.isArray(this.data.archived_notes)) {
            this.data.archived_notes.forEach(n => {
                if (n) list.push({ ...n, _isLive: false });
            });
        }
        return list;
    }

    getCurrentUserDisplayName() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (!session) return 'Commissioner';

        // 1. Check if user has a claimed manager profile in this league
        const userClaim = session.claims?.[this.leagueSlug] || 
            (this.app?.claims && Object.entries(this.app.claims).find(([k, v]) => v?.email && session.email && v.email.toLowerCase() === session.email.toLowerCase())?.[0]);

        if (userClaim) {
            const managersList = this.app?.managers || this.app?.members || window.FANTASY_DATA?.members || [];
            const mgr = managersList.find(m => m.id === userClaim || String(m.id).toLowerCase() === String(userClaim).toLowerCase() || (m.espn_id && String(m.espn_id) === String(userClaim)));
            if (mgr) {
                return mgr.canonical_name || mgr.name || session.name || 'Commissioner';
            }
        }

        // 2. If founder Landon Katz
        if (session.isFounder || (session.email && session.email.toLowerCase() === 'landonekatz@gmail.com')) {
            return 'Landon Katz';
        }

        // 3. Fallback to session name or clean email name
        if (session.name && session.name.trim() && !session.name.includes('@')) {
            return session.name;
        }
        if (session.email) {
            const username = session.email.split('@')[0];
            return username.charAt(0).toUpperCase() + username.slice(1);
        }

        return 'Commissioner';
    }

    render() {
        // Target container
        let container = document.getElementById(this.containerId);
        if (!container && this.leagueSlug === 'dmsfantasy') {
            container = document.getElementById('story');
        }
        if (!container) return;

        // Sync Scroller Pill label if present
        const scrollerLinks = document.querySelectorAll('.scroller-pill');
        scrollerLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${this.containerId}` || (this.leagueSlug === 'dmsfantasy' && href === '#story')) {
                link.textContent = this.data.section_title || 'League Updates';
            }
        });

        const allNotes = this.getAllNotes();
        if (allNotes.length === 0) {
            container.innerHTML = `
                <div class="notes-header-row">
                    <h2>${this.data.section_title || 'Note from the Commissioner'}</h2>
                </div>
                <p style="color: var(--text-muted); font-style: italic;">No notes currently posted.</p>
            `;
            return;
        }

        if (this.currentIndex >= allNotes.length) {
            this.currentIndex = 0;
        }
        if (this.currentIndex < 0) {
            this.currentIndex = 0;
        }

        const activeNote = allNotes[this.currentIndex];
        const isLive = this.currentIndex === 0;
        const hasEditAccess = this.canEdit();
        const totalNotes = allNotes.length;

        // Parse markdown content
        let parsedBody = '';
        if (window.marked && activeNote.content) {
            parsedBody = window.marked.parse(activeNote.content);
        } else {
            parsedBody = (activeNote.content || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
            parsedBody = `<p>${parsedBody}</p>`;
        }

        const createdStr = formatTimestamp(activeNote.created_at);
        const updatedStr = formatTimestamp(activeNote.updated_at);
        const authorName = activeNote.author_name || 'Commissioner';
        const editorName = activeNote.last_edited_by || authorName;
        const isEdited = activeNote.updated_at && activeNote.created_at && (activeNote.updated_at - activeNote.created_at > 60000);

        container.classList.add('commissioner-notes-card');
        container.innerHTML = `
            <div class="notes-card-header">
                <div class="notes-title-group">
                    <h2 class="notes-main-title">${this.data.section_title || 'League Updates'}</h2>
                    ${!isLive ? `
                        <span class="notes-status-badge notes-status-archived">
                            Archived • ${createdStr.split(',')[0] || 'Past Note'}
                        </span>
                    ` : ''}
                </div>

                <div class="notes-controls-group">
                    <!-- Archive Navigation Arrows -->
                    ${totalNotes > 1 ? `
                        <div class="notes-nav-group">
                            <button type="button" class="notes-nav-btn btn-notes-prev" ${this.currentIndex >= totalNotes - 1 ? 'disabled' : ''} title="View older note">
                                ‹ Older
                            </button>
                            <span class="notes-nav-indicator">${this.currentIndex + 1} of ${totalNotes}</span>
                            <button type="button" class="notes-nav-btn btn-notes-next" ${this.currentIndex === 0 ? 'disabled' : ''} title="View newer note">
                                Newer ›
                            </button>
                        </div>
                    ` : ''}

                    <!-- Editor Action Buttons (Strictly Visible ONLY for Authorized Editors) -->
                    ${hasEditAccess ? `
                        <div class="notes-editor-actions">
                            ${isLive ? `
                                <button type="button" class="btn btn-sm btn-notes-edit" title="Edit this live note in-place">
                                    Edit Note
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-sm btn-primary btn-notes-new" title="Create a new note (archives current note)">
                                + New Note
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Note Content Area -->
            <div class="notes-body-wrapper">
                ${activeNote.title ? `<h3 class="notes-headline">${activeNote.title}</h3>` : ''}
                <div class="notes-body-content markdown-body">
                    ${parsedBody}
                </div>
            </div>

            <!-- Note Metadata Footer -->
            <div class="notes-meta-footer">
                <div class="notes-meta-text">
                    <span>Posted by <strong>${authorName}</strong> on ${createdStr || 'Recent'}</span>
                    ${isEdited ? `<span class="notes-meta-edited"> • Last edited by <strong>${editorName}</strong> on ${updatedStr}</span>` : ''}
                </div>
                ${!isLive ? `
                    <button type="button" class="notes-return-live-btn btn btn-sm">
                        Return to Current Note →
                    </button>
                ` : ''}
            </div>
        `;

        // Wire up event listeners
        container.querySelector('.btn-notes-prev')?.addEventListener('click', () => {
            if (this.currentIndex < totalNotes - 1) {
                this.currentIndex++;
                this.render();
            }
        });

        container.querySelector('.btn-notes-next')?.addEventListener('click', () => {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.render();
            }
        });

        container.querySelector('.notes-return-live-btn')?.addEventListener('click', () => {
            this.currentIndex = 0;
            this.render();
        });

        container.querySelector('.btn-notes-edit')?.addEventListener('click', () => {
            this.openEditModal();
        });

        container.querySelector('.btn-notes-new')?.addEventListener('click', () => {
            this.openNewNoteModal();
        });
    }

    attachRichTextEditor(modalEl, editorId, initialContent = '') {
        const editorEl = modalEl.querySelector(`#${editorId}`);
        const countEl = modalEl.querySelector('.editor-word-count');
        if (!editorEl) return;

        // Convert legacy markdown into real HTML so it renders visually formatted
        let htmlContent = initialContent || '';
        if (htmlContent) {
            const hasHtmlTags = /<[a-z][\s\S]*>/i.test(htmlContent);
            if (!hasHtmlTags && window.marked) {
                htmlContent = window.marked.parse(htmlContent);
            } else if (!hasHtmlTags) {
                htmlContent = htmlContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
                htmlContent = `<p>${htmlContent}</p>`;
            }
        }
        editorEl.innerHTML = htmlContent;

        const updateStats = () => {
            const text = editorEl.innerText || '';
            const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
            const chars = text.length;
            if (countEl) {
                countEl.textContent = `${words} word${words !== 1 ? 's' : ''} • ${chars} char${chars !== 1 ? 's' : ''}`;
            }

            // Sync active state on toolbar buttons
            modalEl.querySelectorAll('.editor-tool-btn[data-command]').forEach(btn => {
                const cmd = btn.getAttribute('data-command');
                if (['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].includes(cmd)) {
                    try {
                        if (document.queryCommandState(cmd)) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    } catch (e) {}
                }
            });
        };

        editorEl.addEventListener('input', updateStats);
        editorEl.addEventListener('keyup', updateStats);
        editorEl.addEventListener('mouseup', updateStats);
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === editorEl) {
                updateStats();
            }
        });
        updateStats();

        // Toolbar formatting actions
        modalEl.querySelectorAll('.editor-tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                editorEl.focus();
                const cmd = btn.getAttribute('data-command');
                const val = btn.getAttribute('data-value');

                if (cmd === 'createLink') {
                    const url = prompt('Enter link URL (e.g. https://...):', 'https://');
                    if (url) {
                        document.execCommand('createLink', false, url);
                    }
                } else if (cmd === 'formatBlock') {
                    document.execCommand('formatBlock', false, `<${val}>`);
                } else if (cmd) {
                    document.execCommand(cmd, false, val || null);
                }
                updateStats();
            });
        });
    }

    openEditModal() {
        if (!this.canEdit()) {
            alert('You do not have permission to edit commissioner notes.');
            return;
        }

        const activeNote = this.data.current_note || {};
        const authorName = this.getCurrentUserDisplayName();

        let modal = document.getElementById('notes-action-modal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = 'notes-action-modal';
            modal.className = 'notes-modal-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="notes-modal-content">
                <div class="notes-modal-header">
                    <div>
                        <h3 class="notes-modal-title">Edit Note</h3>
                        <p class="notes-modal-subtitle">
                            Updates the note in-place without creating an archive entry.
                        </p>
                    </div>
                    <button type="button" class="notes-modal-close" onclick="document.getElementById('notes-action-modal').close()">✕</button>
                </div>

                <form id="form-edit-live-note" style="margin-top:1.1rem;">
                    <div style="margin-bottom:1rem;">
                        <label class="editor-field-label">
                            Headline / Subtitle (Optional):
                        </label>
                        <input type="text" id="edit-note-headline-input" class="admin-input editor-title-input" value="${activeNote.title || ''}" placeholder="e.g. Personnel Changes, Week 1 Preview">
                    </div>

                    <!-- Live WYSIWYG Editor Container -->
                    <div style="margin-bottom:1rem;">
                        <label class="editor-field-label">
                            Note Body &amp; Formatting:
                        </label>
                        <div class="editor-container">
                            <div class="editor-toolbar">
                                <button type="button" class="editor-tool-btn" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                                <button type="button" class="editor-tool-btn" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                                <button type="button" class="editor-tool-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                                <button type="button" class="editor-tool-btn" data-command="strikeThrough" title="Strikethrough"><s>S</s></button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h2" title="Heading 2">H2</button>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h3" title="Heading 3">H3</button>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="p" title="Paragraph / Normal Text">P</button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="blockquote" title="Blockquote">”</button>
                                <button type="button" class="editor-tool-btn" data-command="insertUnorderedList" title="Bullet List">• List</button>
                                <button type="button" class="editor-tool-btn" data-command="insertOrderedList" title="Numbered List">1. List</button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="createLink" title="Insert Link">Link</button>
                                <button type="button" class="editor-tool-btn" data-command="insertHorizontalRule" title="Horizontal Divider">Divider</button>
                                <button type="button" class="editor-tool-btn" data-command="removeFormat" title="Clear Formatting">Clear</button>
                            </div>
                            <div contenteditable="true" id="edit-note-body-editor" class="notes-wysiwyg-editor" data-placeholder="Compose your commissioner note or league update here..."></div>
                            <div class="editor-status-bar">
                                <span class="editor-word-count">0 words • 0 characters</span>
                                <span class="editor-hint">Live rich text editor — text actively reflects your styling</span>
                            </div>
                        </div>
                    </div>

                    <!-- Non-Editable Verified Author Attribution -->
                    <div class="editor-attribution-row">
                        <span class="editor-attribution-label">Publishing as:</span>
                        <span class="editor-attribution-pill">
                            <span class="editor-attribution-dot"></span>
                            <strong>${authorName}</strong>
                        </span>
                    </div>

                    <div id="edit-note-feedback" class="admin-feedback-msg" style="display:none; margin-bottom:1rem;"></div>

                    <div class="notes-modal-footer">
                        <button type="button" class="btn-notes-cancel" onclick="document.getElementById('notes-action-modal').close()">Cancel</button>
                        <button type="submit" id="btn-submit-edit-note" class="btn-notes-save">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.style.display = 'block';
        }

        this.attachRichTextEditor(modal, 'edit-note-body-editor', activeNote.content || '');

        modal.querySelector('#form-edit-live-note')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const headline = modal.querySelector('#edit-note-headline-input')?.value?.trim() || '';
            const editorEl = modal.querySelector('#edit-note-body-editor');
            const body = editorEl?.innerHTML?.trim() || '';
            const rawText = editorEl?.innerText?.trim() || '';
            const submitBtn = modal.querySelector('#btn-submit-edit-note');
            const feedbackEl = modal.querySelector('#edit-note-feedback');

            if (!rawText && !body) {
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.color = '#ef4444';
                    feedbackEl.textContent = 'Note body cannot be empty.';
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            const success = await this.saveLiveEdit(headline, body, authorName);
            if (success) {
                modal.close();
                this.render();
                this.renderAdminSection();
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Changes';
                }
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.color = '#ef4444';
                    feedbackEl.textContent = 'Failed to save note. Please try again.';
                }
            }
        });
    }

    openNewNoteModal() {
        if (!this.canEdit()) {
            alert('You do not have permission to publish commissioner notes.');
            return;
        }

        const authorName = this.getCurrentUserDisplayName();

        let modal = document.getElementById('notes-action-modal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = 'notes-action-modal';
            modal.className = 'notes-modal-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="notes-modal-content">
                <div class="notes-modal-header">
                    <div>
                        <h3 class="notes-modal-title">Create New Note</h3>
                        <p class="notes-modal-subtitle">
                            Publishing will automatically archive the current note and establish this one as live.
                        </p>
                    </div>
                    <button type="button" class="notes-modal-close" onclick="document.getElementById('notes-action-modal').close()">✕</button>
                </div>

                <form id="form-new-live-note" style="margin-top:1.1rem;">
                    <div style="margin-bottom:1rem;">
                        <label class="editor-field-label">
                            Headline / Subtitle (Optional):
                        </label>
                        <input type="text" id="new-note-headline-input" class="admin-input editor-title-input" placeholder="e.g. Week 2 Power Rankings, Trade Deadline Notice">
                    </div>

                    <!-- Live WYSIWYG Editor Container -->
                    <div style="margin-bottom:1rem;">
                        <label class="editor-field-label">
                            Note Body &amp; Formatting:
                        </label>
                        <div class="editor-container">
                            <div class="editor-toolbar">
                                <button type="button" class="editor-tool-btn" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                                <button type="button" class="editor-tool-btn" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                                <button type="button" class="editor-tool-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                                <button type="button" class="editor-tool-btn" data-command="strikeThrough" title="Strikethrough"><s>S</s></button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h2" title="Heading 2">H2</button>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h3" title="Heading 3">H3</button>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="p" title="Paragraph / Normal Text">P</button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="blockquote" title="Blockquote">”</button>
                                <button type="button" class="editor-tool-btn" data-command="insertUnorderedList" title="Bullet List">• List</button>
                                <button type="button" class="editor-tool-btn" data-command="insertOrderedList" title="Numbered List">1. List</button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="createLink" title="Insert Link">Link</button>
                                <button type="button" class="editor-tool-btn" data-command="insertHorizontalRule" title="Horizontal Divider">Divider</button>
                                <button type="button" class="editor-tool-btn" data-command="removeFormat" title="Clear Formatting">Clear</button>
                            </div>
                            <div contenteditable="true" id="new-note-body-editor" class="notes-wysiwyg-editor" data-placeholder="Compose your new commissioner note or league update here..."></div>
                            <div class="editor-status-bar">
                                <span class="editor-word-count">0 words • 0 characters</span>
                                <span class="editor-hint">Live rich text editor — text actively reflects your styling</span>
                            </div>
                        </div>
                    </div>

                    <!-- Non-Editable Verified Author Attribution -->
                    <div class="editor-attribution-row">
                        <span class="editor-attribution-label">Publishing as:</span>
                        <span class="editor-attribution-pill">
                            <span class="editor-attribution-dot"></span>
                            <strong>${authorName}</strong>
                        </span>
                    </div>

                    <div id="new-note-feedback" class="admin-feedback-msg" style="display:none; margin-bottom:1rem;"></div>

                    <div class="notes-modal-footer">
                        <button type="button" class="btn-notes-cancel" onclick="document.getElementById('notes-action-modal').close()">Cancel</button>
                        <button type="submit" id="btn-submit-new-note" class="btn-notes-save">Publish Note</button>
                    </div>
                </form>
            </div>
        `;

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.style.display = 'block';
        }

        this.attachRichTextEditor(modal, 'new-note-body-editor', '');

        modal.querySelector('#form-new-live-note')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const headline = modal.querySelector('#new-note-headline-input')?.value?.trim() || '';
            const editorEl = modal.querySelector('#new-note-body-editor');
            const body = editorEl?.innerHTML?.trim() || '';
            const rawText = editorEl?.innerText?.trim() || '';
            const submitBtn = modal.querySelector('#btn-submit-new-note');
            const feedbackEl = modal.querySelector('#new-note-feedback');

            if (!rawText && !body) {
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.color = '#ef4444';
                    feedbackEl.textContent = 'Note body cannot be empty.';
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Publishing...';
            }

            const success = await this.publishNewNote(headline, body, authorName);
            if (success) {
                modal.close();
                this.currentIndex = 0;
                this.render();
                this.renderAdminSection();
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Publish Note';
                }
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.color = '#ef4444';
                    feedbackEl.textContent = 'Failed to publish note. Please try again.';
                }
            }
        });
    }

    async saveLiveEdit(headline, body, editorName) {
        if (!this.canEdit()) {
            console.warn('Unauthorized attempt to edit live note.');
            return false;
        }

        const now = Date.now();
        const resolvedName = editorName || this.getCurrentUserDisplayName();

        if (!this.data.current_note) {
            this.data.current_note = {
                id: `note_${now}`,
                created_at: now
            };
        }

        this.data.current_note.title = headline;
        this.data.current_note.content = body;
        this.data.current_note.updated_at = now;
        this.data.current_note.last_edited_by = resolvedName;
        if (!this.data.current_note.author_name) {
            this.data.current_note.author_name = resolvedName;
        }

        if (database) {
            try {
                const currentRef = dbRef(database, `leagues/${this.leagueSlug}/commissioner_notes/current_note`);
                await set(currentRef, this.data.current_note);
                return true;
            } catch (e) {
                console.error('Error saving live note edit to Firebase:', e);
                return false;
            }
        }
        return true;
    }

    async publishNewNote(headline, body, authorName) {
        if (!this.canEdit()) {
            console.warn('Unauthorized attempt to publish new note.');
            return false;
        }

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const now = Date.now();
        const resolvedName = authorName || this.getCurrentUserDisplayName();

        // 1. Move old current_note to archived_notes
        if (this.data.current_note && (this.data.current_note.content || this.data.current_note.title)) {
            const archived = {
                ...this.data.current_note,
                archived_at: now
            };
            if (!Array.isArray(this.data.archived_notes)) {
                this.data.archived_notes = [];
            }
            this.data.archived_notes.unshift(archived);
        }

        // 2. Create new current_note
        this.data.current_note = {
            id: `note_${now}`,
            title: headline,
            content: body,
            author_name: resolvedName,
            author_email: session?.email || '',
            created_at: now,
            updated_at: now,
            last_edited_by: resolvedName
        };

        if (database) {
            try {
                const notesRef = dbRef(database, `leagues/${this.leagueSlug}/commissioner_notes`);
                await set(notesRef, {
                    section_title: this.data.section_title || 'Note from the Commissioner',
                    allowed_editors: this.data.allowed_editors || [],
                    current_note: this.data.current_note,
                    archived_notes: this.data.archived_notes || []
                });
                return true;
            } catch (e) {
                console.error('Error publishing new note to Firebase:', e);
                return false;
            }
        }
        return true;
    }

    async updateSectionTitle(newTitle) {
        if (!this.canEdit()) return false;
        const cleanTitle = (newTitle || '').trim();
        if (!cleanTitle) return false;
        this.data.section_title = cleanTitle;

        if (database) {
            try {
                const titleRef = dbRef(database, `leagues/${this.leagueSlug}/commissioner_notes/section_title`);
                await set(titleRef, cleanTitle);
            } catch (e) {
                console.error('Error updating section title in Firebase:', e);
                return false;
            }
        }

        this.render();
        return true;
    }

    async addEditor(managerIdOrEmail) {
        if (!this.canEdit()) return false;
        const clean = (managerIdOrEmail || '').trim();
        if (!clean) return false;

        if (!Array.isArray(this.data.allowed_editors)) {
            this.data.allowed_editors = [];
        }

        if (!this.data.allowed_editors.includes(clean)) {
            this.data.allowed_editors.push(clean);
            if (database) {
                try {
                    const editorsRef = dbRef(database, `leagues/${this.leagueSlug}/commissioner_notes/allowed_editors`);
                    await set(editorsRef, this.data.allowed_editors);
                } catch (e) {
                    console.error('Error saving allowed editor to Firebase:', e);
                    return false;
                }
            }
        }
        return true;
    }

    async removeEditor(managerIdOrEmail) {
        if (!this.canEdit()) return false;
        const clean = (managerIdOrEmail || '').trim();
        if (!clean) return false;

        if (!Array.isArray(this.data.allowed_editors)) return true;

        this.data.allowed_editors = this.data.allowed_editors.filter(e => String(e).toLowerCase() !== clean.toLowerCase());
        if (database) {
            try {
                const editorsRef = dbRef(database, `leagues/${this.leagueSlug}/commissioner_notes/allowed_editors`);
                await set(editorsRef, this.data.allowed_editors);
            } catch (e) {
                console.error('Error removing editor in Firebase:', e);
                return false;
            }
        }
        return true;
    }

    renderAdminSection(containerEl) {
        let container = containerEl || document.getElementById(this.adminContainerId);
        if (!container) return;

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const currentTitle = this.data.section_title || 'Note from the Commissioner';
        const managers = this.app?.managers || [];
        const claims = this.app?.claims || {};
        const allowedEditors = this.data.allowed_editors || [];
        const adminEmail = (this.app?.leagueSettings?.admin_email || session?.email || 'Admin').toLowerCase();

        // Sort managers
        const sortedManagers = [...managers].sort((a, b) => (a.canonical_name || a.name || '').localeCompare(b.canonical_name || b.name || ''));
        const availableToAdd = sortedManagers.filter(m => !allowedEditors.includes(m.id));

        const managerOptions = availableToAdd.map(m => {
            const mName = m.canonical_name || m.name || m.id;
            return `<option value="${m.id}">${mName}</option>`;
        }).join('');

        // Build list of editors
        const editorRows = [];

        // 1. Admin Row (Default)
        editorRows.push(`
            <tr style="border-bottom: 1px solid var(--border-line);">
                <td style="padding: 10px 12px; font-weight: 700;">
                    League Administrator (${adminEmail})
                </td>
                <td style="padding: 10px 12px;">
                    <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
                        Admin • Default Edit Access
                    </span>
                </td>
                <td style="padding: 10px 12px; text-align: right; color: var(--text-muted); font-size: 0.8rem;">
                    Default Permitted
                </td>
            </tr>
        `);

        // 2. Additional Editors
        allowedEditors.forEach(ed => {
            const mgr = sortedManagers.find(m => m.id === ed || String(m.id).toLowerCase() === String(ed).toLowerCase());
            const claim = mgr ? claims[mgr.id] : null;
            const displayName = mgr ? (mgr.canonical_name || mgr.name || mgr.id) : ed;
            const claimEmail = claim ? claim.email : (ed.includes('@') ? ed : 'Unclaimed Account');

            editorRows.push(`
                <tr style="border-bottom: 1px solid var(--border-line);">
                    <td style="padding: 10px 12px; font-weight: 600;">
                        ${displayName} <span style="color: var(--text-muted); font-size: 0.82rem; font-weight: normal;">(${claimEmail})</span>
                    </td>
                    <td style="padding: 10px 12px;">
                        <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">
                            Granted Edit Access
                        </span>
                    </td>
                    <td style="padding: 10px 12px; text-align: right;">
                        <button type="button" class="btn btn-sm btn-revoke-editor" data-editor-id="${ed}" style="padding: 3px 8px; font-size: 0.75rem; border: 1px solid #fca5a5; background: #fef2f2; color: #991b1b; border-radius: 4px; cursor: pointer;">
                            Revoke
                        </button>
                    </td>
                </tr>
            `);
        });

        const activeNote = this.data.current_note || {};
        const noteCreatedStr = formatTimestamp(activeNote.created_at);
        const noteUpdatedStr = formatTimestamp(activeNote.updated_at);

        container.innerHTML = `
            <div class="admin-card-header">
                <h2>Commissioner Notes &amp; League Updates</h2>
                <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">
                    Configure the display header, grant editing permissions to members, and manage your league announcements.
                </p>
            </div>

            <!-- 1. Section Header Customization -->
            <div style="margin-top: 1.25rem;">
                <label for="admin-notes-title-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">
                    Section Header / Display Title:
                </label>
                <div class="tagline-presets-wrapper" style="margin-bottom: 8px;">
                    <button type="button" class="btn-tagline-preset btn-notes-title-preset" data-preset="League Updates">"League Updates"</button>
                    <button type="button" class="btn-tagline-preset btn-notes-title-preset" data-preset="Note from the Commissioner">"Note from the Commissioner"</button>
                    <button type="button" class="btn-tagline-preset btn-notes-title-preset" data-preset="Commissioner's Corner">"Commissioner's Corner"</button>
                    <button type="button" class="btn-tagline-preset btn-notes-title-preset" data-preset="Weekly Headlines">"Weekly Headlines"</button>
                </div>
                <div class="tagline-input-row">
                    <input type="text" id="admin-notes-title-input" class="admin-input" value="${currentTitle}" placeholder="e.g. League Updates or Note from the Commissioner">
                    <button type="button" id="btn-save-notes-title" class="btn btn-primary">Save Header</button>
                </div>
                <div id="notes-title-save-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.5rem;"></div>
            </div>

            <!-- 2. Edit Permissions Manager -->
            <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                <label style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">
                    League Note Editors &amp; Permissions:
                </label>
                <p style="font-size: 0.86rem; color: var(--text-muted); margin: 0 0 1rem 0; line-height: 1.45;">
                    By default, only the league admin has edit access. You can grant note editing permissions to as many managers as you like. When granted members sign in, they will see <strong>Edit Note</strong> and <strong>+ New Note</strong> buttons on the home page.
                </p>

                <!-- Add Editor Row -->
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
                    <select id="admin-notes-add-manager-select" class="admin-select" style="min-width: 220px; padding: 7px 10px; font-size: 0.86rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                        <option value="">-- Select Manager to Grant Edit Access --</option>
                        ${managerOptions}
                    </select>
                    <button type="button" id="btn-grant-editor-access" class="btn btn-primary" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer; white-space: nowrap;">
                        Grant Edit Access
                    </button>
                </div>
                <div id="notes-editor-feedback" class="admin-feedback-msg" style="display: none; margin-bottom: 0.75rem;"></div>

                <!-- Editors Table -->
                <div style="overflow-x: auto; border: 1px solid var(--border-line); border-radius: 6px; background: var(--bg-card);">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
                        <thead>
                            <tr style="background: var(--bg-surface); border-bottom: 1px solid var(--border-line);">
                                <th style="padding: 8px 12px; font-weight: 700; color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase;">Manager / Account</th>
                                <th style="padding: 8px 12px; font-weight: 700; color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase;">Permission Level</th>
                                <th style="padding: 8px 12px; font-weight: 700; color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase; text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${editorRows.join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 3. Current Live Note Overview & Quick Action -->
            <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                    <div>
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; color: var(--text-secondary);">
                            Current Live Note Overview:
                        </label>
                        <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-muted);">
                            Posted by <strong>${activeNote.author_name || 'Commissioner'}</strong> on ${noteCreatedStr || 'N/A'}${activeNote.updated_at ? ` (Last edited ${noteUpdatedStr})` : ''}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="btn-admin-edit-live-note" class="btn btn-sm" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer;">
                            Edit Live Note
                        </button>
                        <button type="button" id="btn-admin-create-new-note" class="btn btn-sm btn-primary" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer;">
                            + New Note
                        </button>
                    </div>
                </div>

                <div style="background: var(--bg-surface); border: 1px solid var(--border-line); border-radius: 6px; padding: 1rem;">
                    ${activeNote.title ? `<div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">${activeNote.title}</div>` : ''}
                    <div style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; max-height: 120px; overflow-y: auto;">
                        ${(activeNote.content || 'No content').replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;

        // Wire up Preset buttons
        container.querySelectorAll('.btn-notes-title-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                const input = container.querySelector('#admin-notes-title-input');
                if (input && preset) {
                    input.value = preset;
                }
            });
        });

        // Wire up Save Title button
        container.querySelector('#btn-save-notes-title')?.addEventListener('click', async () => {
            const input = container.querySelector('#admin-notes-title-input');
            const feedback = container.querySelector('#notes-title-save-feedback');
            const val = input ? input.value.trim() : '';
            if (!val) return;

            const btn = container.querySelector('#btn-save-notes-title');
            if (btn) btn.disabled = true;

            const res = await this.updateSectionTitle(val);
            if (btn) btn.disabled = false;

            if (feedback) {
                feedback.style.display = 'block';
                if (res) {
                    feedback.style.color = '#15803d';
                    feedback.textContent = `✓ Section header updated to "${val}"!`;
                } else {
                    feedback.style.color = '#ef4444';
                    feedback.textContent = 'Failed to save section header.';
                }
                setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 4000);
            }
        });

        // Wire up Add Editor button
        container.querySelector('#btn-grant-editor-access')?.addEventListener('click', async () => {
            const select = container.querySelector('#admin-notes-add-manager-select');
            const feedback = container.querySelector('#notes-editor-feedback');
            const selectedMgrId = select ? select.value : '';

            if (!selectedMgrId) {
                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#ef4444';
                    feedback.textContent = 'Please select a manager to grant edit access.';
                }
                return;
            }

            const res = await this.addEditor(selectedMgrId);
            if (feedback) {
                feedback.style.display = 'block';
                if (res) {
                    feedback.style.color = '#15803d';
                    feedback.textContent = `✓ Granted note editing access to ${selectedMgrId}!`;
                } else {
                    feedback.style.color = '#ef4444';
                    feedback.textContent = 'Failed to grant edit access.';
                }
                setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 4000);
            }
            this.renderAdminSection();
        });

        // Wire up Revoke buttons
        container.querySelectorAll('.btn-revoke-editor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const edId = btn.getAttribute('data-editor-id');
                if (!edId) return;
                await this.removeEditor(edId);
                this.renderAdminSection();
            });
        });

        // Wire up Live Note Edit / New Note buttons in Admin
        container.querySelector('#btn-admin-edit-live-note')?.addEventListener('click', () => {
            this.openEditModal();
        });

        container.querySelector('#btn-admin-create-new-note')?.addEventListener('click', () => {
            this.openNewNoteModal();
        });
    }
}
