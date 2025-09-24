// Admin Dashboard JavaScript - Enhanced with Tabbed Interface

// Global variables
let map;
let markers = [];
let alerts = [];
let users = [];
let notificationSound;
let broadcastChannel;
let currentTab = 'dashboard';
let mapLayers = {
    police: null,
    hospitals: null,
    alerts: null
};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Temporary auto-login for testing
    if (!localStorage.getItem('adminLoggedIn')) {
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('officerId', 'admin');
        console.log('Auto-logged in for testing');
    }

    // Check if user is already logged in
    checkLoginStatus();

    // Initialize sound
    notificationSound = document.getElementById('alertSound');

    // Set up BroadcastChannel for real-time communication with user.html
    if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('tourist-safety-alerts');
        broadcastChannel.onmessage = function(event) {
            console.log('Message received:', event.data);
            if (event.data.type === 'SOS_ALERT') {
                console.log('SOS alert received via BroadcastChannel');
                handleNewAlert(event.data.data);
            } else if (event.data.type === 'LOCATION_UPDATE') {
                console.log('Location update received via BroadcastChannel');
                handleLocationUpdate(event.data.data);
            }
        };
    } else {
        // Fallback to localStorage polling if BroadcastChannel is not supported
        console.log('BroadcastChannel not supported, using localStorage polling');
    }

    // Load existing alerts from localStorage
    loadAlerts();
    loadUsers();

    // Set up event listeners
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('clearNotifications').addEventListener('click', clearNotifications);
    document.getElementById('backBtn').addEventListener('click', function() {
        location.reload();
    });

    // Set up tab switching
    setupTabSwitching();

    // Set up storage event listener for fallback
    window.addEventListener('storage', handleStorageChange);

    // Initialize analytics chart
    initializeChart();

    // Load settings
    loadSettings();
});

// Check login status
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');

    console.log('Checking login status:', isLoggedIn);

    if (isLoggedIn) {
        console.log('User is logged in, showing dashboard');
        loginScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');
        initializeMap();
        // Delay update to ensure DOM is ready
        setTimeout(() => updateDashboard(), 100);
    } else {
        console.log('User is not logged in, showing login screen');
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
}

// Handle login
function handleLogin(e) {
    e.preventDefault();

    const officerId = document.getElementById('officerId').value;
    const password = document.getElementById('password').value;

    // Simple validation (in a real app, this would be a server-side check)
    if (officerId && password) {
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('officerId', officerId);
        checkLoginStatus();
    } else {
        alert('Please enter both Officer ID and Password');
    }
}

// Handle logout
function handleLogout() {
    // Clear login status from localStorage
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('officerId');
    
    // Update the UI to show login screen
    checkLoginStatus();
}

// Setup tab switching functionality
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchToTab(tabName);
        });
    });
}

// Switch to specific tab
function switchToTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });

    // Show selected tab content
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
        currentTab = tabName;

        // Update active tab button
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // Update content based on tab
        updateTabContent(tabName);
    }
}

// Update tab content based on current tab
function updateTabContent(tabName) {
    switch(tabName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'alerts':
            updateAlertsTable();
            break;
        case 'map':
            updateMap();
            break;
        case 'users':
            updateUsersTable();
            break;
        case 'reports':
            updateReportsSection();
            break;
        case 'settings':
            updateSettingsSection();
            break;
    }
}

// Lazy load map only when Map View tab is clicked
let mapInitialized = false;

function initializeMap() {
    // Check if map is already initialized to avoid re-initialization error
    if (map) {
        console.log('Map is already initialized, skipping re-initialization');
        return;
    }

    // Check if the map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Show loading indicator
    mapContainer.innerHTML = '<div class="loading">Loading map...</div>';

    // Initialize map after a short delay to simulate faster loading
    setTimeout(() => {
        try {
            console.log('Initializing map');
            // Default to New Delhi coordinates
            map = L.map('map').setView([28.6139, 77.2090], 10);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            // Initialize map layers
            initializeMapLayers();

        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }, 500); // 500ms delay for faster perceived loading
}

// Initialize map layers
function initializeMapLayers() {
    // Police stations layer
    mapLayers.police = L.layerGroup().addTo(map);

    // Hospitals layer
    mapLayers.hospitals = L.layerGroup().addTo(map);

    // Alerts layer (already handled by markers)
    mapLayers.alerts = L.layerGroup().addTo(map);

    // Add some sample police stations and hospitals
    addSampleLocations();
}

// Add sample locations for demonstration
function addSampleLocations() {
    // Sample police stations
    const policeStations = [
        { name: 'Connaught Place Police Station', lat: 28.6328, lng: 77.2197 },
        { name: 'Saket Police Station', lat: 28.5245, lng: 77.2066 },
        { name: 'Karol Bagh Police Station', lat: 28.6517, lng: 77.1889 }
    ];

    // Sample hospitals
    const hospitals = [
        { name: 'AIIMS Hospital', lat: 28.5672, lng: 77.2100 },
        { name: 'Fortis Hospital', lat: 28.5355, lng: 77.3910 },
        { name: 'Apollo Hospital', lat: 28.6385, lng: 77.2956 }
    ];

    // Add police stations
    policeStations.forEach(station => {
        L.marker([station.lat, station.lng], {
            icon: L.divIcon({
                html: '👮',
                className: 'custom-div-icon police-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        })
        .bindPopup(`<div class="poi-popup"><h4>${station.name}</h4><p>Police Station</p></div>`)
        .addTo(mapLayers.police);
    });

    // Add hospitals
    hospitals.forEach(hospital => {
        L.marker([hospital.lat, hospital.lng], {
            icon: L.divIcon({
                html: '🏥',
                className: 'custom-div-icon hospital-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        })
        .bindPopup(`<div class="poi-popup"><h4>${hospital.name}</h4><p>Hospital</p></div>`)
        .addTo(mapLayers.hospitals);
    });
}

// Toggle map layers
function toggleMapLayer(layerName) {
    const layer = mapLayers[layerName];
    if (layer) {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        } else {
            map.addLayer(layer);
        }
    }
}

// Load alerts from localStorage
function loadAlerts() {
    const storedAlerts = localStorage.getItem('sosAlerts');
    if (storedAlerts) {
        alerts = JSON.parse(storedAlerts);
    }
}

// Load users from localStorage
function loadUsers() {
    const storedUsers = localStorage.getItem('registeredUsers');
    if (storedUsers) {
        users = JSON.parse(storedUsers);
    }
}

// Check for new alerts (fallback for browsers without BroadcastChannel)
function checkForNewAlerts() {
    const storedAlerts = localStorage.getItem('sosAlerts');
    if (storedAlerts) {
        const parsedAlerts = JSON.parse(storedAlerts);

        // Check if there are new alerts
        if (parsedAlerts.length > alerts.length) {
            const newAlerts = parsedAlerts.slice(alerts.length);
            newAlerts.forEach(alert => handleNewAlert(alert));
        }

        alerts = parsedAlerts;
    }
}

// Only run polling if BroadcastChannel is not available
if (typeof BroadcastChannel === 'undefined') {
    console.log('Starting localStorage polling fallback');
    setInterval(checkForNewAlerts, 2000);
}

// Handle new alert
function handleNewAlert(alert) {
    console.log('New SOS alert received:', alert);
    // Add to alerts array
    alerts.push(alert);

    // Save to localStorage
    localStorage.setItem('sosAlerts', JSON.stringify(alerts));

    // Play sound notification
    playAlertSound();

    // Update the dashboard
    updateDashboard();

    // Show notification
    showNotification(alert);
    console.log('Alerts array after adding:', alerts);
}

// Handle location update
function handleLocationUpdate(locationData) {
    // Update the user marker on the map
    if (map) {
        // Remove existing user marker if it exists
        if (window.userMarker) {
            map.removeLayer(window.userMarker);
        }

        // Add new user marker
        window.userMarker = L.marker([locationData.lat, locationData.lng], {
            icon: L.divIcon({
                html: '📍',
                className: 'custom-div-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map);

        window.userMarker.bindPopup(`
            <div class="poi-popup">
                <h4>User Location</h4>
                <p>Current position</p>
            </div>
        `);

        // Optionally, center the map on the user location
        map.setView([locationData.lat, locationData.lng], 13);
    }
}

// Play alert sound
function playAlertSound() {
    if (notificationSound) {
        notificationSound.play().catch(e => {
            console.log('Audio play failed:', e);
            // Show visual indicator if sound is blocked
            showSoundBlockedIndicator();
        });
    }
}

// Show visual indicator if sound is blocked
function showSoundBlockedIndicator() {
    const badge = document.getElementById('alertBadge');
    badge.style.animation = 'pulse 0.5s ease-in-out 3';

    setTimeout(() => {
        badge.style.animation = '';
    }, 1500);
}

// Update the entire dashboard
function updateDashboard() {
    console.log('Updating dashboard');
    updateMap();
    updateAlertsTable();
    updateAnalytics();
    updateVerificationPanel();
    updateRecentActivity();
}

// Update the map with markers
function updateMap() {
    console.log('Updating map with', alerts.length, 'alerts');
    // Check if map is initialized
    if (!map) {
        console.warn('Map not initialized, skipping update');
        return;
    }

    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Add markers for each alert
    alerts.forEach(alert => {
        // Enhanced check for latitude and longitude
        if (alert && typeof alert.latitude === 'number' && typeof alert.longitude === 'number' &&
            !isNaN(alert.latitude) && !isNaN(alert.longitude) &&
            alert.latitude !== null && alert.longitude !== null &&
            alert.latitude >= -90 && alert.latitude <= 90 &&
            alert.longitude >= -180 && alert.longitude <= 180) {
            try {
                console.log('Creating marker for alert:', alert.id, 'at', alert.latitude, alert.longitude);
                const marker = L.marker([alert.latitude, alert.longitude]).addTo(map);

                // Create popup content
                const popupContent = `
                    <div class="popup-content">
                        <h3>SOS Alert</h3>
                        <p><strong>User:</strong> ${alert.userName}</p>
                        <p><strong>ID:</strong> ${alert.idNumber}</p>
                        <p><strong>Location:</strong> ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}</p>
                        <p><strong>Time:</strong> ${alert.timestamp}</p>
                        <div class="popup-actions">
                            <button class="resolve-btn" onclick="markResolved('${alert.id}')">Mark Resolved</button>
                            <button class="dispatch-btn" onclick="dispatchHelp('${alert.id}')">Dispatch</button>
                            <button class="delete-btn" onclick="deleteAlert('${alert.id}')">Delete</button>
                        </div>
                    </div>
                `;

                marker.bindPopup(popupContent);
                markers.push(marker);
            } catch (error) {
                console.error('Error creating marker for alert:', alert.id, error);
            }
        } else {
            console.warn('Skipping marker for alert with invalid or missing coordinates:', alert);
        }
    });

    // Adjust map view to show all markers if there are alerts
    if (alerts.length > 0 && markers.length > 0) {
        try {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        } catch (error) {
            console.error('Error adjusting map view:', error);
        }
    }
}

// Helper function to format location safely
function formatLocation(alert) {
    if (alert && typeof alert.latitude === 'number' && typeof alert.longitude === 'number' &&
        !isNaN(alert.latitude) && !isNaN(alert.longitude)) {
        return `${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}`;
    } else {
        return 'N/A';
    }
}

// Update the alerts table
function updateAlertsTable() {
    const tableBody = document.getElementById('alertsTableBody');
    if (!tableBody) {
        console.error('alertsTableBody not found');
        return;
    }
    tableBody.innerHTML = '';

    alerts.forEach(alert => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${alert.userName || 'N/A'}</td>
            <td>${alert.idNumber || 'N/A'}</td>
            <td class="blockchain-id">${alert.blockchainId || 'N/A'}</td>
            <td>${formatLocation(alert)}</td>
            <td>${alert.timestamp || 'N/A'}</td>
            <td>${alert.nearestPolice && alert.nearestPolice.name ? alert.nearestPolice.name : 'N/A'}</td>
            <td>${alert.nearestHospital && alert.nearestHospital.name ? alert.nearestHospital.name : 'N/A'}</td>
            <td class="status-${alert.status || 'unknown'}">${alert.status || 'unknown'}</td>
            <td>
                <button class="action-btn dispatch-btn" onclick="dispatchHelp('${alert.id}')">Dispatch</button>
                <button class="action-btn resolve-btn" onclick="markResolved('${alert.id}')">Resolve</button>
            </td>
            <td>
                <button class="action-btn delete-btn" onclick="deleteAlert('${alert.id}')">Delete</button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    // Update alert badge
    const pendingAlerts = alerts.filter(alert => alert.status === 'pending').length;
    document.getElementById('alertBadge').textContent = pendingAlerts;
    console.log('Updated alerts table with', alerts.length, 'alerts');
}

// Update users table
function updateUsersTable() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) {
        console.error('usersTableBody not found');
        return;
    }
    tableBody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name || 'N/A'}</td>
            <td>${user.idNumber || 'N/A'}</td>
            <td class="blockchain-id">${user.blockchainId || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td class="status-${user.status || 'active'}">${user.status || 'active'}</td>
            <td>${user.lastActive || 'N/A'}</td>
            <td>
                <button class="action-btn dispatch-btn" onclick="viewUserDetails('${user.id}')">View</button>
                <button class="action-btn resolve-btn" onclick="contactUser('${user.id}')">Contact</button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    // Update user statistics
    updateUserStatistics();
}

// Update user statistics
function updateUserStatistics() {
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.status === 'active').length;
    const newUsersToday = users.filter(user => {
        const today = new Date().toDateString();
        return user.lastActive && user.lastActive.includes(today);
    }).length;
    const verifiedUsers = users.filter(user => user.verified).length;

    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('newUsersToday').textContent = newUsersToday;
    document.getElementById('verifiedUsers').textContent = verifiedUsers;
}

// Search users
function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm) ||
        user.idNumber.toLowerCase().includes(searchTerm) ||
        user.blockchainId.toLowerCase().includes(searchTerm)
    );

    // Update the table with filtered results
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';

    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name || 'N/A'}</td>
            <td>${user.idNumber || 'N/A'}</td>
            <td class="blockchain-id">${user.blockchainId || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td class="status-${user.status || 'active'}">${user.status || 'active'}</td>
            <td>${user.lastActive || 'N/A'}</td>
            <td>
                <button class="action-btn dispatch-btn" onclick="viewUserDetails('${user.id}')">View</button>
                <button class="action-btn resolve-btn" onclick="contactUser('${user.id}')">Contact</button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// Update analytics
function updateAnalytics() {
    const totalAlerts = alerts.length;
    const resolvedAlerts = alerts.filter(alert => alert.status === 'resolved').length;
    const pendingAlerts = alerts.filter(alert => alert.status === 'pending').length;
    const activeTourists = new Set(alerts.map(alert => alert.userName)).size;

    document.getElementById('totalAlerts').textContent = totalAlerts;
    document.getElementById('resolvedAlerts').textContent = resolvedAlerts;
    document.getElementById('pendingAlerts').textContent = pendingAlerts;
    document.getElementById('activeTourists').textContent = activeTourists;

    updateChart(resolvedAlerts, pendingAlerts);
}

// Initialize the analytics chart
function initializeChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');

    // Create a simple donut chart using canvas
    window.analyticsChart = {
        ctx: ctx,
        draw: function(resolved, pending) {
            const total = resolved + pending;
            const centerX = ctx.canvas.width / 2;
            const centerY = ctx.canvas.height / 2;
            const radius = Math.min(centerX, centerY) - 10;

            // Clear canvas
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            if (total === 0) {
                // Draw empty circle
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = '#ddd';
                ctx.lineWidth = 20;
                ctx.stroke();
                return;
            }

            // Draw resolved segment
            const resolvedAngle = (resolved / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, resolvedAngle);
            ctx.strokeStyle = '#2ed573';
            ctx.lineWidth = 20;
            ctx.stroke();

            // Draw pending segment
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, resolvedAngle, Math.PI * 2);
            ctx.strokeStyle = '#ffa502';
            ctx.lineWidth = 20;
            ctx.stroke();

            // Draw center text
            ctx.fillStyle = '#333';
            ctx.font = 'bold 16px Poppins';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${total}`, centerX, centerY);

            ctx.font = '10px Poppins';
            ctx.fillText('Alerts', centerX, centerY + 15);
        }
    };
}

// Update the chart
function updateChart(resolved, pending) {
    if (window.analyticsChart && window.analyticsChart.draw) {
        window.analyticsChart.draw(resolved, pending);
    }
}

// Update verification panel
function updateVerificationPanel() {
    const verificationPanel = document.getElementById('verificationPanel');

    if (alerts.length === 0) {
        verificationPanel.innerHTML = '<p>Select an alert to verify its blockchain integrity</p>';
        return;
    }

    // Show the first alert for verification (in a real app, you'd select one)
    const alert = alerts[0];

    verificationPanel.innerHTML = `
        <div class="verification-item">
            <div class="verification-header">
                <strong>Alert: ${alert.userName}</strong>
                <button class="verify-btn" onclick="verifyBlockchain('${alert.id}')">Verify</button>
            </div>
            <div class="verification-hash">${alert.blockchainId}</div>
            <div class="verification-status" id="verificationStatus-${alert.id}">
                <span>Not verified</span>
            </div>
        </div>
    `;
}

// Update recent activity
function updateRecentActivity() {
    const activityList = document.getElementById('recentActivity');

    if (alerts.length === 0) {
        activityList.innerHTML = '<p class="no-activity">No recent activity</p>';
        return;
    }

    activityList.innerHTML = '';

    // Show last 5 activities
    const recentAlerts = alerts.slice(-5).reverse();

    recentAlerts.forEach(alert => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon">🚨</div>
            <div class="activity-details">
                <div class="activity-title">SOS Alert from ${alert.userName}</div>
                <div class="activity-time">${alert.timestamp}</div>
            </div>
        `;
        activityList.appendChild(activityItem);
    });
}

// Update reports section
function updateReportsSection() {
    const reportSummary = document.getElementById('reportSummary');
    reportSummary.innerHTML = `
        <div class="report-stats">
            <div class="report-stat">
                <span class="stat-label">Total Alerts:</span>
                <span class="stat-value">${alerts.length}</span>
            </div>
            <div class="report-stat">
                <span class="stat-label">Resolved:</span>
                <span class="stat-value">${alerts.filter(a => a.status === 'resolved').length}</span>
            </div>
            <div class="report-stat">
                <span class="stat-label">Pending:</span>
                <span class="stat-value">${alerts.filter(a => a.status === 'pending').length}</span>
            </div>
            <div class="report-stat">
                <span class="stat-label">Total Users:</span>
                <span class="stat-value">${users.length}</span>
            </div>
        </div>
        <p>Generate a custom report using the form above.</p>
    `;
}

// Update settings section
function updateSettingsSection() {
    // Load current settings
    const settings = loadSettings();

    document.getElementById('refreshInterval').value = settings.refreshInterval || 30;
    document.getElementById('maxAlerts').value = settings.maxAlerts || 50;
    document.getElementById('soundEnabled').checked = settings.soundEnabled !== false;
}

// Load settings from localStorage
function loadSettings() {
    const settings = localStorage.getItem('adminSettings');
    return settings ? JSON.parse(settings) : {};
}

// Save settings to localStorage
function saveSettings() {
    const settings = {
        refreshInterval: parseInt(document.getElementById('refreshInterval').value),
        maxAlerts: parseInt(document.getElementById('maxAlerts').value),
        soundEnabled: document.getElementById('soundEnabled').checked
    };

    localStorage.setItem('adminSettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
}

// Generate report
function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    // Simulate report generation
    const reportSummary = document.getElementById('reportSummary');
    reportSummary.innerHTML = `
        <div class="report-loading">Generating ${reportType} report...</div>
    `;

    setTimeout(() => {
        reportSummary.innerHTML = `
            <div class="report-generated">
                <h3>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report Generated</h3>
                <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
                <p><strong>Total Alerts:</strong> ${alerts.length}</p>
                <p><strong>Resolved:</strong> ${alerts.filter(a => a.status === 'resolved').length}</p>
                <p><strong>Pending:</strong> ${alerts.filter(a => a.status === 'pending').length}</p>
                <p><strong>Generated at:</strong> ${new Date().toLocaleString()}</p>
            </div>
        `;
    }, 2000);
}

// Export report
function exportReport(format) {
    alert(`Exporting report as ${format.toUpperCase()}...`);

    // Simulate export process
    setTimeout(() => {
        alert(`Report exported successfully as ${format.toUpperCase()}!`);
    }, 1500);
}

// Refresh blockchain info
function refreshBlockchainInfo() {
    const networkElement = document.getElementById('blockchainNetwork');
    const blockElement = document.getElementById('lastBlock');
    const gasElement = document.getElementById('gasPrice');

    // Simulate refresh
    networkElement.textContent = 'Ethereum Mainnet';
    blockElement.textContent = Math.floor(Math.random() * 1000000) + 18000000;
    gasElement.textContent = Math.floor(Math.random() * 50) + 20 + ' Gwei';

    alert('Blockchain information refreshed!');
}

// Update emergency contacts
function updateEmergencyContacts() {
    const policeContact = document.getElementById('policeContact').value;
    const hospitalContact = document.getElementById('hospitalContact').value;
    const fireContact = document.getElementById('fireContact').value;

    if (policeContact || hospitalContact || fireContact) {
        const contacts = {
            police: policeContact,
            hospital: hospitalContact,
            fire: fireContact
        };

        localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
        alert('Emergency contacts updated successfully!');
    } else {
        alert('Please enter at least one emergency contact number.');
    }
}

// Verify blockchain
function verifyBlockchain(alertId) {
    const statusElement = document.getElementById(`verificationStatus-${alertId}`);

    // Simulate verification process
    statusElement.innerHTML = '<span>Verifying...</span>';

    setTimeout(() => {
        statusElement.innerHTML = `
            <span class="verified">✓ Verified</span>
            <span class="verification-tick">✅</span>
        `;

        // Add verification animation
        const tick = statusElement.querySelector('.verification-tick');
        tick.style.animation = 'tick 0.5s ease-in-out';
    }, 1500);
}

// Show notification
function showNotification(alert) {
    const notificationList = document.getElementById('notificationList');

    const notification = document.createElement('div');
    notification.className = 'notification-item new-alert';
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">New SOS Alert from ${alert.userName || 'N/A'}</div>
            <div class="notification-time">${alert.timestamp || 'N/A'}</div>
        </div>
        <div class="notification-details">
            <p>Location: ${formatLocation(alert)}</p>
            <p>Nearest Police: ${alert.nearestPolice && alert.nearestPolice.name ? alert.nearestPolice.name : 'N/A'}</p>
            <p>Nearest Hospital: ${alert.nearestHospital && alert.nearestHospital.name ? alert.nearestHospital.name : 'N/A'}</p>
        </div>
        <div class="notification-actions">
            <button class="notification-btn call-btn" onclick="callUser('${alert.id}')">Call User</button>
            <button class="notification-btn ambulance-btn" onclick="sendAmbulance('${alert.id}')">Send Ambulance</button>
            <button class="notification-btn police-btn" onclick="dispatchPolice('${alert.id}')">Dispatch Police</button>
        </div>
    `;

    // Add to the top of the list
    notificationList.insertBefore(notification, notificationList.firstChild);

    // Remove animation class after animation completes
    setTimeout(() => {
        notification.classList.remove('new-alert');
    }, 500);
}

// Clear notifications
function clearNotifications() {
    document.getElementById('notificationList').innerHTML = '';
}

// Action functions
function markResolved(alertId) {
    const alertIndex = alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex !== -1) {
        alerts[alertIndex].status = 'resolved';
        localStorage.setItem('sosAlerts', JSON.stringify(alerts));
        updateDashboard();
    }
}

function dispatchHelp(alertId) {
    alert(`Help dispatched for alert ${alertId}`);
    // In a real app, this would trigger an actual dispatch process
}

function callUser(alertId) {
    alert(`Calling user for alert ${alertId}`);
}

function sendAmbulance(alertId) {
    alert(`Ambulance dispatched for alert ${alertId}`);
}

function dispatchPolice(alertId) {
    alert(`Police dispatched for alert ${alertId}`);
}

function deleteAlert(alertId) {
    const alertIndex = alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex !== -1) {
        alerts.splice(alertIndex, 1);
        localStorage.setItem('sosAlerts', JSON.stringify(alerts));
        updateDashboard();
        alert(`Alert ${alertId} deleted successfully`);
    }
}

function viewUserDetails(userId) {
    alert(`Viewing details for user ${userId}`);
}

function contactUser(userId) {
    alert(`Contacting user ${userId}`);
}

// Handle storage change for fallback
function handleStorageChange(e) {
    if (e.key === 'sosAlertBroadcast') {
        // This is handled by admin dashboard
        console.log('Storage change detected:', e.newValue);
        const data = JSON.parse(e.newValue);
        console.log('SOS alert received via localStorage fallback');
        handleNewAlert(data.data);
    } else if (e.key === 'locationUpdateBroadcast') {
        const data = JSON.parse(e.newValue);
        console.log('Location update received via localStorage fallback');
        handleLocationUpdate(data.data);
    }
}

// Generate mock data for demonstration
function generateMockData() {
    // Only generate if no alerts exist
    if (alerts.length === 0) {
        const mockAlerts = [
            {
                id: 'alert1',
                userName: 'Rajesh Kumar',
                idNumber: 'A1234567',
                blockchainId: '0x1a2b3c4d5e6f7890abcdef1234567890',
                latitude: 28.6139,
                longitude: 77.2090,
                timestamp: '22 Sept 2025, 10:30 AM',
                nearestPolice: 'Connaught Place Police Station',
                nearestHospital: 'AIIMS Hospital',
                status: 'pending'
            },
            {
                id: 'alert2',
                userName: 'Priya Sharma',
                idNumber: 'P9876543',
                blockchainId: '0x2b3c4d5e6f7890abcdef12345678901',
                latitude: 28.5355,
                longitude: 77.3910,
                timestamp: '22 Sept 2025, 11:45 AM',
                nearestPolice: 'Saket Police Station',
                nearestHospital: 'Fortis Hospital',
                status: 'pending'
            }
        ];

        mockAlerts.forEach(alert => {
            alerts.push(alert);
        });

        localStorage.setItem('sosAlerts', JSON.stringify(alerts));
        updateDashboard();
    }
}

// Call this function to add mock data for demonstration
// generateMockData();

// Initialize notifications system
function initializeNotifications() {
    // Create notification container if it doesn't exist
    if (!document.getElementById('notificationList')) {
        const notificationsSection = document.createElement('div');
        notificationsSection.className = 'notifications-section';
        notificationsSection.innerHTML = `
            <div class="section-header">
                <h2>🔔 Recent Notifications</h2>
                <button class="clear-btn" id="clearNotifications">Clear All</button>
            </div>
            <div class="notification-list" id="notificationList">
                <!-- Notifications will be added here -->
            </div>
        `;

        // Add to dashboard tab
        const dashboardTab = document.getElementById('dashboard');
        if (dashboardTab) {
            const contentGrid = dashboardTab.querySelector('.content-grid');
            if (contentGrid) {
                contentGrid.appendChild(notificationsSection);
            }
        }
    }

    // Set up clear notifications button
    const clearBtn = document.getElementById('clearNotifications');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearNotifications);
    }
}

// Initialize verification system
function initializeVerification() {
    // Create verification container if it doesn't exist
    if (!document.getElementById('verificationPanel')) {
        const verificationSection = document.createElement('div');
        verificationSection.className = 'verification-section';
        verificationSection.innerHTML = `
            <h3>🔗 Blockchain Verification</h3>
            <div id="verificationPanel">
                <!-- Verification items will be added here -->
            </div>
        `;

        // Add to dashboard tab
        const dashboardTab = document.getElementById('dashboard');
        if (dashboardTab) {
            const contentGrid = dashboardTab.querySelector('.content-grid');
            if (contentGrid) {
                contentGrid.appendChild(verificationSection);
            }
        }
    }
}
