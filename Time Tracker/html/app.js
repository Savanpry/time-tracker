/**
 * StellarTime - Premium Project stopwatch Time Tracker
 * Focuses purely on project-based tracking with automatic pause-interlocks
 */

const PRESET_COLORS = [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#10b981', // Green
    '#f59e0b', // Orange
    '#ef4444', // Red
    '#ec4899', // Pink
    '#14b8a6'  // Teal
];

const DEFAULT_PROJECTS = [];

const AppState = {
    projects: [],
    activeProjectId: null,
    lastTickTime: null,
    selectedFormColor: PRESET_COLORS[0],
    timerInterval: null,

    init() {
        this.load();
        this.renderPresets();
        this.renderProjectsList();
        this.updateTotalTimeDisplay();
        this.setupListeners();

        // Check if there was an active project before shutdown/reload
        if (this.activeProjectId) {
            const activeProj = this.projects.find(p => p.id === this.activeProjectId);
            if (activeProj && this.lastTickTime) {
                const gap = Math.floor((Date.now() - this.lastTickTime) / 1000);
                if (gap > 0 && gap < 10) {
                    // Recover elapsed seconds during brief reload
                    activeProj.timeElapsed += gap;
                }
                // Establish a fresh tick baseline for the resume interval
                this.lastTickTime = Date.now();
                this.save();
                // Resume timer
                this.runTimerInterval();
            } else {
                this.activeProjectId = null;
                this.lastTickTime = null;
                this.save();
                this.renderProjectsList();
            }
        }
    },

    load() {
        const saved = localStorage.getItem('stellar_tracker_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.projects = parsed.projects || [];
                this.activeProjectId = parsed.activeProjectId || null;
                this.lastTickTime = parsed.lastTickTime || null;
            } catch (e) {
                console.error("Failed to load state, resetting to default", e);
                this.loadDefaults();
            }
        } else {
            this.loadDefaults();
        }
    },

    loadDefaults() {
        this.projects = JSON.parse(JSON.stringify(DEFAULT_PROJECTS));
        this.activeProjectId = null;
        this.lastTickTime = null;
        this.save();
    },

    save() {
        localStorage.setItem('stellar_tracker_state', JSON.stringify({
            projects: this.projects,
            activeProjectId: this.activeProjectId,
            lastTickTime: this.lastTickTime
        }));
    },

    startTimer(projectId) {
        // Automatically pauses other projects by stopping current running timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.activeProjectId = projectId;
        this.lastTickTime = Date.now();
        this.save();

        this.renderProjectsList();
        this.runTimerInterval();
    },

    pauseTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.activeProjectId = null;
        this.lastTickTime = null;
        this.save();

        this.renderProjectsList();
        document.title = "StellarTime | Premium Project Time Tracker";
    },

    runTimerInterval() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Ticking is calculated based on Date.now() compared to lastTickTime.
        // We run the interval frequently (every 200ms) to ensure responsive clock updates and zero drift.
        this.timerInterval = setInterval(() => {
            if (!this.activeProjectId) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                return;
            }

            const activeProj = this.projects.find(p => p.id === this.activeProjectId);
            if (activeProj) {
                const now = Date.now();
                const deltaMs = now - this.lastTickTime;
                const deltaSec = Math.floor(deltaMs / 1000);

                if (deltaSec >= 1) {
                    activeProj.timeElapsed += deltaSec;
                    this.lastTickTime += deltaSec * 1000;
                    this.save();

                    // Perform performant text-content updates for ticking clocks
                    const projectClock = document.getElementById(`project-time-${activeProj.id}`);
                    if (projectClock) {
                        projectClock.textContent = this.formatSeconds(activeProj.timeElapsed);
                    }

                    this.updateTotalTimeDisplay();

                    // Update tab title with timer progress
                    const timeStr = this.formatSeconds(activeProj.timeElapsed);
                    document.title = `⏱️ ${timeStr} | ${activeProj.name}`;
                }
            }
        }, 200);
    },

    addProject(name, color) {
        const newProj = {
            id: 'proj-' + Date.now(),
            name: name,
            timeElapsed: 0,
            color: color
        };
        this.projects.push(newProj);
        this.save();
        this.renderProjectsList();
    },

    deleteProject(projectId) {
        this.openConfirmModal(
            "Delete Project?",
            `Are you sure you want to delete this project? All recorded time data (${this.formatSeconds(this.projects.find(p => p.id === projectId).timeElapsed)}) will be lost.`,
            () => {
                if (this.activeProjectId === projectId) {
                    this.pauseTimer();
                }
                this.projects = this.projects.filter(p => p.id !== projectId);
                this.save();
                this.renderProjectsList();
                this.updateTotalTimeDisplay();
            }
        );
    },

    resetAll() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        localStorage.removeItem('stellar_tracker_state');
        this.loadDefaults();
        this.renderProjectsList();
        this.updateTotalTimeDisplay();
        document.title = "StellarTime | Premium Project Time Tracker";
    },

    // --- DOM RENDERING ---
    renderPresets() {
        const container = document.getElementById('color-presets-container');
        if (!container) return;
        
        container.innerHTML = '';
        PRESET_COLORS.forEach((color, idx) => {
            const swatch = document.createElement('div');
            swatch.className = `color-swatch ${idx === 0 ? 'selected' : ''}`;
            swatch.style.backgroundColor = color;
            swatch.setAttribute('data-color', color);
            swatch.onclick = () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                this.selectedFormColor = color;
            };
            container.appendChild(swatch);
        });
        this.selectedFormColor = PRESET_COLORS[0];
    },

    renderProjectsList() {
        const grid = document.getElementById('projects-grid');
        if (!grid) return;

        if (this.projects.length === 0) {
            grid.innerHTML = `
                <div class="no-projects-view">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <p>No projects found. Add a project above to get started!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        this.projects.forEach(proj => {
            const isActive = proj.id === this.activeProjectId;
            const rgbString = this.hexToRgbString(proj.color);
            
            const card = document.createElement('div');
            card.className = `glass-card project-card ${isActive ? 'active' : ''}`;
            card.style.setProperty('--accent-color', proj.color);
            card.style.setProperty('--accent-color-rgb', rgbString);
            
            card.innerHTML = `
                <div class="project-card-header">
                    <span class="project-name-title">${this.escapeHTML(proj.name)}</span>
                    <div class="project-status">
                        <span class="project-status-dot"></span>
                        <span>${isActive ? 'Tracking' : 'Paused'}</span>
                    </div>
                </div>
                <div class="project-time-display" id="project-time-${proj.id}">
                    ${this.formatSeconds(proj.timeElapsed)}
                </div>
                <div class="project-card-actions">
                    <button class="btn-project-toggle" title="${isActive ? 'Pause Timer' : 'Start Timer'}" onclick="AppState.toggleProject('${proj.id}')">
                        ${isActive ? `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16"></rect>
                                <rect x="14" y="4" width="4" height="16"></rect>
                            </svg>
                        ` : `
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        `}
                    </button>
                    <button class="btn-project-delete" title="Delete Project" onclick="AppState.deleteProject('${proj.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    toggleProject(projectId) {
        if (this.activeProjectId === projectId) {
            this.pauseTimer();
        } else {
            this.startTimer(projectId);
        }
    },

    updateTotalTimeDisplay() {
        const totalSec = this.projects.reduce((sum, p) => sum + p.timeElapsed, 0);
        const display = document.getElementById('total-time-display');
        if (display) {
            display.textContent = this.formatSeconds(totalSec);
        }
    },

    setupListeners() {
        // Add Project Form
        const form = document.getElementById('add-project-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const input = document.getElementById('new-project-name');
                const name = input.value.trim();
                if (name) {
                    this.addProject(name, this.selectedFormColor);
                    input.value = '';
                    this.renderPresets();
                }
            };
        }

        // Global Reset All Button
        const resetBtn = document.getElementById('btn-reset-all');
        if (resetBtn) {
            resetBtn.onclick = () => {
                this.openConfirmModal(
                    "Reset All Data?",
                    "Are you sure you want to reset all tracking data? This will clear all projects and timers, and cannot be undone.",
                    () => {
                        this.resetAll();
                    }
                );
            };
        }
    },

    // --- MODAL CONFIRMATION ENGINE ---
    openConfirmModal(title, message, onConfirm) {
        const overlay = document.getElementById('confirm-modal');
        if (!overlay) return;

        overlay.querySelector('.modal-title').textContent = title;
        overlay.querySelector('.modal-body p').textContent = message;
        overlay.classList.add('active');

        const proceedBtn = document.getElementById('btn-confirm-proceed');
        const cancelBtn = document.getElementById('btn-confirm-cancel');

        // Replace buttons to clear previous event listeners cleanly
        const newProceed = proceedBtn.cloneNode(true);
        proceedBtn.parentNode.replaceChild(newProceed, proceedBtn);

        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newProceed.onclick = () => {
            onConfirm();
            overlay.classList.remove('active');
        };

        newCancel.onclick = () => {
            overlay.classList.remove('active');
        };
    },

    // --- UTILITY METHODS ---
    formatSeconds(totalSec) {
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        
        return [
            hrs.toString().padStart(2, '0'),
            mins.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
        ].join(':');
    },

    hexToRgbString(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    },

    escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
});
