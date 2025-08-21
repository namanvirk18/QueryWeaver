/**
 * Main application entry point - coordinates all modules
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

// Shared helper: fetch graph data and call showGraph; falls back to empty message on error
async function loadAndShowGraph(selected) {
    if (!selected) {
        return;
    }
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

        // Clear any existing placeholder content before rendering
        const container = document.getElementById('schema-graph');
        if (container) container.innerHTML = '';

        showGraph(data);
    } catch (err) {
        console.error('Error fetching graph data:', err);
    }
}

// Initialize the application
function initializeApp() {
    // Initialize chat
    initChat();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up UI components
    setupUIComponents();
    
    // Load initial data
    loadInitialData();
}

function setupEventListeners() {
    // Chat functionality
    DOM.submitButton.addEventListener('click', sendMessage);
    DOM.pauseButton.addEventListener('click', pauseRequest);
    DOM.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Menu functionality
    DOM.menuButton.addEventListener('click', () => toggleContainer(DOM.menuContainer));

    // Schema functionality: fetch graph data for the selected graph when panel opens
    DOM.schemaButton.addEventListener('click', () => {
        toggleContainer(DOM.schemaContainer, async () => {
            const selected = DOM.graphSelect.value;

            // If no graph is selected
            if (!selected) {
                return;
            }

            await loadAndShowGraph(selected);
        });
    });

    // Reset functionality
    DOM.newChatButton.addEventListener('click', showResetConfirmation);
    DOM.resetConfirmBtn.addEventListener('click', handleResetConfirmation);
    DOM.resetCancelBtn.addEventListener('click', hideResetConfirmation);

    // Modal interactions
    DOM.resetConfirmationModal.addEventListener('click', (e) => {
        if (e.target === DOM.resetConfirmationModal) {
            hideResetConfirmation();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && DOM.resetConfirmationModal.style.display === 'flex') {
            hideResetConfirmation();
        }
    });

    // Graph management
    DOM.graphSelect.addEventListener("change", async () => {
        // Preserve existing behavior
        onGraphChange();

        // If the schema panel is currently open, fetch and render the selected graph
        const selected = DOM.graphSelect.value;
        if (!selected) return;

        if (DOM.schemaContainer && DOM.schemaContainer.classList.contains('open')) {
            await loadAndShowGraph(selected);
        }
    });
    DOM.fileUpload.addEventListener('change', handleFileUpload);

    // Window resize handling
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeApp);
