/**
 * Main application entry point (TypeScript)
 */

import { DOM } from "./modules/config";
import { initChat } from "./modules/messages";
import { sendMessage, pauseRequest } from "./modules/chat";
import { loadGraphs, handleFileUpload, onGraphChange } from "./modules/graphs";
import { getSelectedGraph } from "./modules/graph_select";
import {
  toggleContainer,
  showResetConfirmation,
  hideResetConfirmation,
  handleResetConfirmation,
  setupUserProfileDropdown,
  setupThemeToggle,
  setupToolbar,
  handleWindowResize,
  setupCustomDropdown,
  setupResizeHandles,
} from "./modules/ui";
import { setupAuthenticationModal, setupDatabaseModal } from "./modules/modals";
import { resizeGraph, showGraph } from "./modules/schema";
import { setupTokenManagement } from "./modules/tokens";
import { initLeftToolbar } from "./modules/left_toolbar";
import { setupTextareaAutoResize } from "./modules/input";

async function loadAndShowGraph(selected: string | undefined) {
  if (!selected || selected === "Select Database") return;
  try {
    const resp = await fetch(`/graphs/${encodeURIComponent(selected)}/data`);
    if (!resp.ok) {
      console.error("Failed to load graph data:", resp.status, resp.statusText);
      return;
    }

    const data = await resp.json();

    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.warn(
        "Graph data returned in unexpected shape, showing empty message",
        data
      );
      return;
    }

    const container = document.getElementById("schema-graph");
    if (container) container.innerHTML = "";

    showGraph(data);
  } catch (err) {
    console.error("Error fetching graph data:", err);
  }
}

function updateInputState() {
  const submitButton = DOM.submitButton;
  const messageInput = DOM.messageInput;
  if (!submitButton || !messageInput) return;
  
  const selected = getSelectedGraph();
  const isDatabaseSelected = selected && selected !== "Select Database";
  
  if (isDatabaseSelected) {
    messageInput.disabled = false;
    messageInput.placeholder = "Describe the SQL query you want...";
    // Enable submit button only if there's also text in the input
    if (messageInput.value.trim()) {
      submitButton.disabled = false;
    } else {
      submitButton.disabled = true;
    }
  } else {
    messageInput.disabled = true;
    messageInput.placeholder = "Please select a database first...";
    submitButton.disabled = true;
  }
}

function initializeApp() {
  initChat();
  setupEventListeners();
  setupUIComponents();
  loadInitialData();
}

function setupEventListeners() {
  DOM.submitButton?.addEventListener("click", sendMessage);
  DOM.pauseButton?.addEventListener("click", pauseRequest);
  DOM.messageInput?.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e as KeyboardEvent).key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  DOM.messageInput?.addEventListener("input", () => {
    updateInputState();
  });

  DOM.menuButton?.addEventListener("click", () =>
    toggleContainer(DOM.menuContainer as HTMLElement)
  );

  DOM.schemaButton?.addEventListener("click", () => {
    toggleContainer(DOM.schemaContainer as HTMLElement, async () => {
      const selected = getSelectedGraph();
      if (!selected) return;
      loadAndShowGraph(selected);
      setTimeout(resizeGraph, 450);
    });
  });

  DOM.graphSelectRefresh?.addEventListener("click", async () => {
    const selected = getSelectedGraph();
    const refreshButton = DOM.graphSelectRefresh;

    if (!refreshButton) return;

    if (!selected || selected === "Select Database")
      return console.debug("No selected graph");

    refreshButton.classList.add("loading");

    const result = await fetch(
      `/graphs/${encodeURIComponent(selected)}/refresh`,
      {
        method: "POST",
      }
    );

    if (!result.ok) {
      console.error(
        "Failed to refresh graph:",
        result.status,
        result.statusText
      );
      return;
    }

    if (result.body) {
      const reader = result.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete messages separated by boundary
          const messages = buffer.split("|||FALKORDB_MESSAGE_BOUNDARY|||");
          buffer = messages.pop() || ""; // Keep incomplete message in buffer

          for (const message of messages) {
            if (message.trim()) {
              try {
                const parsed = JSON.parse(message.trim());

                if (parsed.type === "reasoning_step") {
                  refreshButton.title += ` ${parsed.message}\n`;
                } else if (parsed.type === "final_result") {
                  refreshButton.title += ` ${parsed.message}`;
                }
              } catch (e) {
                console.warn("Failed to parse message:", message, e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    if (DOM.schemaContainer && DOM.schemaContainer.classList.contains("open")) {
      await loadAndShowGraph(selected);
      setTimeout(resizeGraph, 450);
    }

    refreshButton.classList.remove("loading");
    refreshButton.title = "";
  });

  DOM.newChatButton?.addEventListener("click", showResetConfirmation);
  DOM.resetConfirmBtn?.addEventListener("click", handleResetConfirmation);
  DOM.resetCancelBtn?.addEventListener("click", hideResetConfirmation);

  DOM.resetConfirmationModal?.addEventListener("click", (e) => {
    if (e.target === DOM.resetConfirmationModal) hideResetConfirmation();
  });

  document.addEventListener("keydown", (e) => {
    if (
      (e as KeyboardEvent).key === "Escape" &&
      DOM.resetConfirmationModal &&
      DOM.resetConfirmationModal.style.display === "flex"
    ) {
      hideResetConfirmation();
    }
  });

  // Legacy select is hidden; custom UI will trigger load via graph_select helper
  document
    .getElementById("graph-options")
    ?.addEventListener("click", async () => {
      onGraphChange();
      const selected = getSelectedGraph();
      if (!selected) return;
      const selectedLabel = document.getElementById("graph-selected");
      if (selectedLabel) {
        const dropdownText = selectedLabel.querySelector(
          ".dropdown-text"
        ) as HTMLElement | null;
        if (dropdownText) {
          dropdownText.textContent = selected;
          dropdownText.title = selected;
        }
      }
      if (
        DOM.schemaContainer &&
        DOM.schemaContainer.classList.contains("open")
      ) {
        loadAndShowGraph(selected);
        setTimeout(resizeGraph, 450);
      }
    });

  DOM.fileUpload?.addEventListener("change", handleFileUpload);
  window.addEventListener("resize", handleWindowResize);

  // Expose toggleSidebar function globally for HTML template onclick handlers
  (window as any).toggleSidebar = function(containerId: string) {
    const container = document.getElementById(containerId) as HTMLElement;
    if (container) {
      toggleContainer(container, containerId === 'schema-container' ? async () => {
        const selected = getSelectedGraph();
        if (!selected) return;
        loadAndShowGraph(selected);
        setTimeout(resizeGraph, 450);
      } : undefined);
    }
  };
}

function setupUIComponents() {
  setupUserProfileDropdown();
  setupThemeToggle();
  setupAuthenticationModal();
  setupDatabaseModal();
  setupTokenManagement();
  setupToolbar();
  // initialize left toolbar behavior (burger, responsive default)
  initLeftToolbar();
  setupCustomDropdown();
  setupTextareaAutoResize();
  setupResizeHandles();
}

function loadInitialData() {
  loadGraphs();
  updateInputState(); // Set initial input state based on database selection
}

// Expose updateInputState globally so other modules can use it
(window as any).updateInputState = updateInputState;

document.addEventListener("DOMContentLoaded", initializeApp);
