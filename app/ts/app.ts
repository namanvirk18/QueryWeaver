/**
 * Main application entry point (TypeScript)
 */

import { DOM } from './modules/config.js';
import { initChat } from './modules/messages.js';
import { sendMessage, pauseRequest } from './modules/chat.js';
import { loadGraphs, handleFileUpload, onGraphChange } from './modules/graphs.js';
import {
    toggleContainer,
    showResetConfirmation,
    hideResetConfirmation,
    handleResetConfirmation,
    setupUserProfileDropdown,
    setupThemeToggle,
    setupToolbar,
    handleWindowResize,
    setupCustomDropdown
} from './modules/ui.js';
import { setupAuthenticationModal, setupDatabaseModal } from './modules/modals.js';
import { showGraph } from './modules/schema.js';

async function loadAndShowGraph(selected: string | undefined) {
    if (!selected) return;
    try {
        const resp = await fetch(`/graphs/${encodeURIComponent(selected)}/data`);
        if (!resp.ok) {
            console.error('Failed to load graph data:', resp.status, resp.statusText);
            return;
        }

        const data = await resp.json();

        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
            console.warn('Graph data returned in unexpected shape, showing empty message', data);
            return;
        }

        const container = document.getElementById('schema-graph');
        if (container) container.innerHTML = '';

        showGraph(data);
    } catch (err) {
        console.error('Error fetching graph data:', err);
    }
}

function initializeApp() {
    initChat();
    setupEventListeners();
    setupUIComponents();
    loadInitialData();
}

function setupEventListeners() {
    DOM.submitButton?.addEventListener('click', sendMessage);
    DOM.pauseButton?.addEventListener('click', pauseRequest);
    DOM.messageInput?.addEventListener('keypress', (e: KeyboardEvent) => {
        if ((e as KeyboardEvent).key === 'Enter') sendMessage();
    });

    DOM.menuButton?.addEventListener('click', () => toggleContainer(DOM.menuContainer as HTMLElement));

    DOM.schemaButton?.addEventListener('click', () => {
        toggleContainer(DOM.schemaContainer as HTMLElement, async () => {
            const selected = DOM.graphSelect?.value;
            if (!selected) return;
            await loadAndShowGraph(selected);
        });
    });

    DOM.newChatButton?.addEventListener('click', showResetConfirmation);
    DOM.resetConfirmBtn?.addEventListener('click', handleResetConfirmation);
    DOM.resetCancelBtn?.addEventListener('click', hideResetConfirmation);

    DOM.resetConfirmationModal?.addEventListener('click', (e) => {
        if (e.target === DOM.resetConfirmationModal) hideResetConfirmation();
    });

    document.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape' && DOM.resetConfirmationModal && DOM.resetConfirmationModal.style.display === 'flex') {
            hideResetConfirmation();
        }
    });

    DOM.graphSelect?.addEventListener('change', async () => {
        onGraphChange();
        const selected = DOM.graphSelect?.value;
        if (!selected) return;
        if (DOM.schemaContainer && DOM.schemaContainer.classList.contains('open')) {
            await loadAndShowGraph(selected);
        }
    });

    DOM.fileUpload?.addEventListener('change', handleFileUpload);
    window.addEventListener('resize', handleWindowResize);
}

function setupUIComponents() {
    setupUserProfileDropdown();
    setupThemeToggle();
    setupAuthenticationModal();
    setupDatabaseModal();
    setupToolbar();
    setupCustomDropdown();
}

function loadInitialData() {
    loadGraphs();
}

document.addEventListener('DOMContentLoaded', initializeApp);
