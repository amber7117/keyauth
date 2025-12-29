// 自动检测环境：本地开发用localhost，生产环境用当前域名
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : `${window.location.origin}/api`;
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
let requires2FA = false;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showDashboard();
        loadDashboardData();
    } else {
        showLogin();
    }

    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) {
                navigateTo(page);
            }
        });
    });

    // User management
    document.getElementById('addUserBtn')?.addEventListener('click', () => showModal('userModal'));
    document.getElementById('userForm')?.addEventListener('submit', handleCreateUser);

    // License management
    document.getElementById('generateLicensesBtn')?.addEventListener('click', () => showModal('licenseModal'));
    document.getElementById('licenseForm')?.addEventListener('submit', handleGenerateLicenses);
    document.getElementById('exportLicensesBtn')?.addEventListener('click', exportLicenses);

    // Settings
    document.getElementById('changePasswordForm')?.addEventListener('submit', handleChangePassword);
    document.getElementById('enable2FABtn')?.addEventListener('click', handleEnable2FA);
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const twoFactorCode = document.getElementById('login2FA').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, twoFactorCode: twoFactorCode || undefined })
        });

        const data = await response.json();

        if (data.requires2FA) {
            document.getElementById('2faGroup').style.display = 'block';
            requires2FA = true;
            showError('Please enter your 2FA code');
            return;
        }

        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            showDashboard();
            loadDashboardData();
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Login failed. Please try again.');
    }
}

function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = {};
    showLogin();
}

// API Requests
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };

    const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options });
    const data = await response.json();

    if (response.status === 401) {
        handleLogout();
        throw new Error('Unauthorized');
    }

    return data;
}

// Dashboard
async function loadDashboardData() {
    try {
        const stats = await apiRequest('/stats');

        if (stats.success) {
            // Update stat cards
            document.getElementById('totalUsers').textContent = stats.stats.users.total;
            document.getElementById('activeSubscriptions').textContent = stats.stats.subscriptions.active;
            document.getElementById('unusedLicenses').textContent = stats.stats.licenses.unused;
            document.getElementById('bannedUsers').textContent = stats.stats.users.banned;

            // Update user info
            document.getElementById('currentUsername').textContent = currentUser.username;

            // Update expiring soon table
            updateExpiringSoonTable(stats.stats.expiringSoon);

            // Update charts
            updateUserGrowthChart(stats.stats.userGrowth);
            updateSubscriptionChart(stats.stats.subscriptionTypes);
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateExpiringSoonTable(data) {
    const tbody = document.querySelector('#expiringSoonTable tbody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.username}</td>
            <td>${item.subscription_name}</td>
            <td>${new Date(item.expiry_date).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateUserGrowthChart(data) {
    const ctx = document.getElementById('userGrowthChart').getContext('2d');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [{
                label: 'New Users',
                data: data.map(d => d.count),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: '#ffffff' }
                }
            },
            scales: {
                x: { ticks: { color: '#a0aec0' }, grid: { color: '#4a5568' } },
                y: { ticks: { color: '#a0aec0' }, grid: { color: '#4a5568' } }
            }
        }
    });
}

function updateSubscriptionChart(data) {
    const ctx = document.getElementById('subscriptionChart').getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.subscription_type),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: ['#667eea', '#48bb78', '#ed8936', '#f56565']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: '#ffffff' }
                }
            }
        }
    });
}

// Users Management
async function loadUsers() {
    try {
        const data = await apiRequest('/users');

        if (data.success) {
            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = '';

            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td><span class="status-badge status-${user.status}">${user.status}</span></td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                    <td>
                        <button class="action-btn edit" onclick="editUser(${user.id})">Edit</button>
                        <button class="action-btn delete" onclick="deleteUser(${user.id})">Delete</button>
                        ${user.is_banned ? 
                            `<button class="action-btn" onclick="banUser(${user.id}, false)">Unban</button>` :
                            `<button class="action-btn" onclick="banUser(${user.id}, true)">Ban</button>`
                        }
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function handleCreateUser(e) {
    e.preventDefault();

    const userData = {
        username: document.getElementById('userUsername').value,
        password: document.getElementById('userPassword').value,
        email: document.getElementById('userEmail').value,
        hwid: document.getElementById('userHWID').value
    };

    try {
        const data = await apiRequest('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (data.success) {
            closeModal('userModal');
            loadUsers();
            showSuccess('User created successfully');
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Failed to create user');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const data = await apiRequest(`/users/${id}`, { method: 'DELETE' });

        if (data.success) {
            loadUsers();
            showSuccess('User deleted successfully');
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Failed to delete user');
    }
}

async function banUser(id, isBanned) {
    const reason = isBanned ? prompt('Enter ban reason:') : null;

    try {
        const data = await apiRequest(`/users/${id}/ban`, {
            method: 'POST',
            body: JSON.stringify({ isBanned, reason })
        });

        if (data.success) {
            loadUsers();
            showSuccess(data.message);
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Failed to ban/unban user');
    }
}

// License Management
async function loadLicenses() {
    try {
        const data = await apiRequest('/licenses');

        if (data.success) {
            const tbody = document.querySelector('#licensesTable tbody');
            tbody.innerHTML = '';

            data.licenses.forEach(license => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${license.id}</td>
                    <td><code>${license.license_key}</code></td>
                    <td>${license.subscription_type}</td>
                    <td>${license.duration_days} days</td>
                    <td><span class="status-badge status-${license.status}">${license.status}</span></td>
                    <td>${new Date(license.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="action-btn delete" onclick="deleteLicense(${license.id})">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Failed to load licenses:', error);
    }
}

async function handleGenerateLicenses(e) {
    e.preventDefault();

    const licenseData = {
        count: document.getElementById('licenseCount').value,
        subscriptionType: document.getElementById('licenseType').value,
        durationDays: document.getElementById('licenseDuration').value
    };

    try {
        const data = await apiRequest('/licenses/generate', {
            method: 'POST',
            body: JSON.stringify(licenseData)
        });

        if (data.success) {
            closeModal('licenseModal');
            loadLicenses();
            showSuccess(`Generated ${data.licenses.length} license(s)`);
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Failed to generate licenses');
    }
}

async function deleteLicense(id) {
    if (!confirm('Are you sure you want to delete this license?')) return;

    try {
        const data = await apiRequest(`/licenses/${id}`, { method: 'DELETE' });

        if (data.success) {
            loadLicenses();
            showSuccess('License deleted successfully');
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Failed to delete license');
    }
}

function exportLicenses() {
    window.open(`${API_URL}/licenses/export/csv`, '_blank');
}

// Activity Logs
async function loadActivity() {
    try {
        const data = await apiRequest('/activity?limit=100');

        if (data.success) {
            const tbody = document.querySelector('#activityTable tbody');
            tbody.innerHTML = '';

            data.logs.forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${log.id}</td>
                    <td>${log.username || 'System'}</td>
                    <td>${log.action}</td>
                    <td>${log.details || 'N/A'}</td>
                    <td>${log.ip_address || 'N/A'}</td>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Failed to load activity logs:', error);
    }
}

// Settings
async function handleChangePassword(e) {
    e.preventDefault();

    const passwordData = {
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value
    };

    try {
        const data = await apiRequest('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });

        if (data.success) {
            e.target.reset();
            showSuccess('Password changed successfully');
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('Failed to change password');
    }
}

async function handleEnable2FA() {
    try {
        const data = await apiRequest('/auth/2fa/enable', { method: 'POST' });

        if (data.success) {
            const code = prompt('Enter the 6-digit code from your authenticator app:');

            if (code) {
                const verifyData = await apiRequest('/auth/2fa/verify', {
                    method: 'POST',
                    body: JSON.stringify({ secret: data.secret, code })
                });

                if (verifyData.success) {
                    showSuccess('2FA enabled successfully');
                } else {
                    showError(verifyData.message);
                }
            }
        }
    } catch (error) {
        showError('Failed to enable 2FA');
    }
}

// Navigation
function navigateTo(page) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    // Update active view
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    const viewId = `${page}View`;
    document.getElementById(viewId)?.classList.add('active');

    // Update page title
    document.getElementById('pageTitle').textContent = 
        page.charAt(0).toUpperCase() + page.slice(1);

    // Load page data
    switch (page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'licenses':
            loadLicenses();
            break;
        case 'activity':
            loadActivity();
            break;
    }
}

// UI Helpers
function showLogin() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('dashboardPage').classList.remove('active');
}

function showDashboard() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
}

function showModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById(modalId).classList.remove('active');
}

function showError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

function showSuccess(message) {
    alert(message); // You can replace this with a better notification system
}

// Global functions for inline onclick handlers
window.editUser = editUser;
window.deleteUser = deleteUser;
window.banUser = banUser;
window.deleteLicense = deleteLicense;
window.closeModal = closeModal;

function editUser(id) {
    // Implement edit user functionality
    console.log('Edit user:', id);
}
