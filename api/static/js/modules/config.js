/**
 * Constants and configuration for the chat application
 */

// Custom delimiter that's unlikely to appear in your data
export const MESSAGE_DELIMITER = '|||FALKORDB_MESSAGE_BOUNDARY|||';

// DOM element selectors
export const SELECTORS = {
    messageInput: '#message-input',
    submitButton: '#submit-button',
    pauseButton: '#pause-button',
    newChatButton: '#reset-button',
    chatMessages: '#chat-messages',
    expValue: '#exp-value',
    confValue: '#conf-value',
    missValue: '#info-value',
    ambValue: '#amb-value',
    fileUpload: '#schema-upload',
    fileLabel: '#custom-file-upload',
    sideMenuButton: '#side-menu-button',
    menuButton: '#menu-button',
    schemaButton: '#schema-button',
    menuContainer: '#menu-container',
    schemaContainer: '#schema-container',
    chatContainer: '#chat-container',
    leftToolbar: '#left-toolbar',
    toolbarButtons: '#toolbar-buttons',
    leftToolbarInner: '#left-toolbar-inner',
    expInstructions: '#instructions-textarea',
    inputContainer: '#input-container',
    graphSelect: '#graph-select',
    resetConfirmationModal: '#reset-confirmation-modal',
    resetConfirmBtn: '#reset-confirm-btn',
    resetCancelBtn: '#reset-cancel-btn'
};

// Get DOM elements
export const DOM = {
    messageInput: document.getElementById('message-input'),
    submitButton: document.getElementById('submit-button'),
    pauseButton: document.getElementById('pause-button'),
    newChatButton: document.getElementById('reset-button'),
    chatMessages: document.getElementById('chat-messages'),
    expValue: document.getElementById('exp-value'),
    confValue: document.getElementById('conf-value'),
    missValue: document.getElementById('info-value'),
    ambValue: document.getElementById('amb-value'),
    fileUpload: document.getElementById('schema-upload'),
    fileLabel: document.getElementById('custom-file-upload'),
    menuButton: document.getElementById('menu-button'),
    schemaButton: document.getElementById('schema-button'),
    menuContainer: document.getElementById('menu-container'),
    schemaContainer: document.getElementById('schema-container'),
    chatContainer: document.getElementById('chat-container'),
    leftToolbar: document.getElementById('left-toolbar'),
    toolbarButtons: document.getElementById('toolbar-buttons'),
    leftToolbarInner: document.getElementById('left-toolbar-inner'),
    expInstructions: document.getElementById('instructions-textarea'),
    inputContainer: document.getElementById('input-container'),
    graphSelect: document.getElementById('graph-select'),
    resetConfirmationModal: document.getElementById('reset-confirmation-modal'),
    resetConfirmBtn: document.getElementById('reset-confirm-btn'),
    resetCancelBtn: document.getElementById('reset-cancel-btn')
};

// Application state
export const state = {
    questions_history: [],
    result_history: [],
    currentRequestController: null
};

// URL parameters
export const urlParams = new URLSearchParams(window.location.search);
