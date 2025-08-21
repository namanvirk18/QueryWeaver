/**
 * Modal dialogs and authentication (TypeScript)
 */

export function setupAuthenticationModal() {
    const isAuthenticated = (window as any).isAuthenticated !== undefined ? (window as any).isAuthenticated : false;
    const googleLoginModal = document.getElementById('google-login-modal') as HTMLElement | null;
    const container = document.getElementById('container') as HTMLElement | null;

    if (googleLoginModal && container) {
        if (!isAuthenticated) {
            googleLoginModal.style.display = 'flex';
            container.style.filter = 'blur(2px)';
        } else {
            googleLoginModal.style.display = 'none';
            container.style.filter = '';
        }
    }
}

function setLoadingState(isLoading: boolean, connectBtn: HTMLButtonElement, urlInput: HTMLInputElement) {
    const connectText = connectBtn.querySelector('.db-modal-connect-text') as HTMLElement | null;
    const loadingSpinner = connectBtn.querySelector('.db-modal-loading-spinner') as HTMLElement | null;
    const cancelBtn = document.getElementById('db-modal-cancel') as HTMLButtonElement | null;

    if (connectText) connectText.style.display = isLoading ? 'none' : 'inline';
    if (loadingSpinner) loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    connectBtn.disabled = isLoading;
    if (cancelBtn) cancelBtn.disabled = isLoading;
    urlInput.disabled = isLoading;
}

export function setupDatabaseModal() {
    const dbModal = document.getElementById('db-modal') as HTMLElement | null;
    const cancelDbModalBtn = document.getElementById('db-modal-cancel') as HTMLButtonElement | null;
    const connectDbModalBtn = document.getElementById('db-modal-connect') as HTMLButtonElement | null;
    const dbUrlInput = document.getElementById('db-url-input') as HTMLInputElement | null;
    const dbTypeSelect = document.getElementById('database-type-select') as HTMLSelectElement | null;
    const dbModalTitle = document.getElementById('db-modal-title') as HTMLElement | null;

    const databaseConfig: Record<string, { title: string; placeholder: string; example: string }> = {
        postgresql: {
            title: 'Connect to PostgreSQL',
            placeholder: 'postgresql://username:password@host:port/database',
            example: 'postgresql://myuser:mypass@localhost:5432/mydb'
        },
        mysql: {
            title: 'Connect to MySQL',
            placeholder: 'mysql://username:password@host:port/database',
            example: 'mysql://myuser:mypass@localhost:3306/mydb'
        }
    };

    if (!dbTypeSelect || !dbUrlInput || !connectDbModalBtn || !dbModal || !dbModalTitle) return;

    dbTypeSelect.addEventListener('change', function(this: HTMLSelectElement) {
        const selectedType = this.value;
        if (selectedType && databaseConfig[selectedType]) {
            dbUrlInput.disabled = false;
            dbUrlInput.placeholder = databaseConfig[selectedType].placeholder;
            dbModal.style.display = 'flex';
            dbModalTitle.textContent = databaseConfig[selectedType].title;
            connectDbModalBtn.disabled = false;
            setTimeout(() => dbUrlInput.focus(), 100);
        } else {
            dbUrlInput.disabled = true;
            dbUrlInput.placeholder = 'Select database type first...';
            connectDbModalBtn.disabled = true;
        }
    });

    if (cancelDbModalBtn && dbModal) {
        cancelDbModalBtn.addEventListener('click', function() {
            dbModal.style.display = 'none';
            if (dbTypeSelect) dbTypeSelect.selectedIndex = 0;
            if (connectDbModalBtn) connectDbModalBtn.disabled = true;
        });
    }

    document.addEventListener('keydown', function(e) {
        if (dbModal && dbModal.style.display === 'flex' && e.key === 'Escape') {
            dbModal.style.display = 'none';
        }
    });

    dbUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            connectDbModalBtn.click();
        }
    });

    connectDbModalBtn.addEventListener('click', function() {
        const dbUrl = dbUrlInput.value.trim();
        const selectedType = dbTypeSelect.value;

        if (!selectedType) {
            alert('Please select a database type.');
            return;
        }
        if (!dbUrl) {
            alert('Please enter a database URL.');
            return;
        }

        if (selectedType === 'postgresql' && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
            alert('PostgreSQL URL must start with postgresql:// or postgres://');
            return;
        }
        if (selectedType === 'mysql' && !dbUrl.startsWith('mysql://')) {
            alert('MySQL URL must start with mysql://');
            return;
        }

        setLoadingState(true, connectDbModalBtn, dbUrlInput);

        fetch('/database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: dbUrl })
        }).then(response => response.json())
          .then(data => {
            setLoadingState(false, connectDbModalBtn, dbUrlInput);
            if (data.success) {
                dbModal.style.display = 'none';
                if (dbTypeSelect) dbTypeSelect.selectedIndex = 0;
                if (connectDbModalBtn) connectDbModalBtn.disabled = true;
                location.reload();
            } else {
                alert('Failed to connect: ' + (data.error || 'Unknown error'));
            }
          }).catch(error => {
            setLoadingState(false, connectDbModalBtn, dbUrlInput);
            alert('Error connecting to database: ' + (error as Error).message);
          });
    });
}
