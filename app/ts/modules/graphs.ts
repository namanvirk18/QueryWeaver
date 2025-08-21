/**
 * Graph loading and management functionality (TypeScript)
 */

import { DOM } from './config';     
import { addMessage, initChat } from './messages';

export function loadGraphs() {
    const isAuthenticated = (window as any).isAuthenticated !== undefined ? (window as any).isAuthenticated : false;

    if (!isAuthenticated) {
        if (DOM.graphSelect) DOM.graphSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Please log in to access graphs';
        option.disabled = true;
        if (DOM.graphSelect) DOM.graphSelect.appendChild(option);

        if (DOM.messageInput) DOM.messageInput.disabled = true;
        if (DOM.submitButton) DOM.submitButton.disabled = true;
        if (DOM.messageInput) DOM.messageInput.placeholder = 'Please log in to start chatting';
        return;
    }

    fetch('/graphs')
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in to access graphs.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then((data: string[]) => {
            if (DOM.graphSelect) DOM.graphSelect.innerHTML = '';

            if (!data || data.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No graphs available';
                option.disabled = true;
                if (DOM.graphSelect) DOM.graphSelect.appendChild(option);

                if (DOM.messageInput) DOM.messageInput.disabled = true;
                if (DOM.submitButton) DOM.submitButton.disabled = true;
                if (DOM.messageInput) DOM.messageInput.placeholder = 'Please upload a schema or connect a database to start chatting';

                addMessage('No graphs are available. Please upload a schema file or connect to a database to get started.', false);
                return;
            }

            data.forEach(graph => {
                const option = document.createElement('option');
                option.value = graph;
                option.textContent = graph;
                option.title = graph;
                if (DOM.graphSelect) DOM.graphSelect.appendChild(option);
            });

            if (DOM.messageInput) DOM.messageInput.disabled = false;
            if (DOM.submitButton) DOM.submitButton.disabled = false;
            if (DOM.messageInput) DOM.messageInput.placeholder = 'Describe the SQL query you want...';
        })
        .catch(error => {
            console.error('Error fetching graphs:', error);

            if ((error as Error).message.includes('Authentication required')) {
                addMessage('Authentication required. Please log in to access your graphs.', false);
            } else {
                addMessage('Sorry, there was an error fetching the available graphs: ' + (error as Error).message, false);
                if (DOM.messageInput) DOM.messageInput.disabled = true;
                if (DOM.submitButton) DOM.submitButton.disabled = true;
                if (DOM.messageInput) DOM.messageInput.placeholder = 'Cannot connect to server';
            }

            if (DOM.graphSelect) DOM.graphSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = (error as Error).message.includes('Authentication') ? 'Please log in' : 'Error loading graphs';
            option.disabled = true;
            if (DOM.graphSelect) DOM.graphSelect.appendChild(option);
        });
}

export function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files ? target.files[0] : null;
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/graphs', {
        method: 'POST',
        body: formData
    }).then(response => response.json())
      .then(data => {
        console.log('File uploaded successfully', data);
      }).catch(error => {
        console.error('Error uploading file:', error);
        addMessage('Sorry, there was an error uploading your file: ' + (error as Error).message, false);
      });
}

export function onGraphChange() {
    initChat();
}
