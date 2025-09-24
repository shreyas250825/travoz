/**
 * Government of India Tourist Safety System - User App JavaScript
 * 
 * Instructions for testing:
 * 1. Open user.html and admin.html in separate browser tabs/windows
 * 2. Login to user app with any details (mock authentication)
 * 3. Login to admin dashboard (Officer ID: admin, Password: password)
 * 4. In user app, go to Emergency tab and click SOS button
 * 5. Check admin dashboard - new alert should appear instantly with sound
 * 6. Test other features like location sharing, travel planner, contacts
 */

// Global variables
let map;
let userMarker;
let userLocation = { lat: 12.9716, lng: 77.5946 }; // Default: Bengaluru
let locationSharing = false;
let locationInterval;
let sosActive = false;
let sosData = null;

// Mock POI data for Bengaluru area
const policeStations = [
    { id: 1, name: "Cubbon Park Police Station", lat: 12.9762, lng: 77.5993, distance: 0 },
    { id: 2, name: "Vidhana Soudha Police Station", lat: 12.9795, lng: 77.5910, distance: 0 },
    { id: 3, name: "UB City Police Station", lat: 12.9719, lng: 77.6095, distance: 0 },
    { id: 4, name: "Commercial Street Police Station", lat: 12.9831, lng: 77.6101, distance: 0 }
];

const hospitals = [
    { id: 1, name: "Manipal Hospital", lat: 12.9698, lng: 77.6205, distance: 0 },
    { id: 2, name: "St. John's Medical College", lat: 12.9312, lng: 77.6228, distance: 0 },
    { id: 3, name: "Apollo Hospital", lat: 12.9180, lng: 77.6170, distance: 0 },
    { id: 4, name: "Fortis Hospital", lat: 12.9279, lng: 77.6271, distance: 0 }
];

// Broadcast channel for real-time communication
let broadcastChannel;
try {
    broadcastChannel = new BroadcastChannel('tourist-safety-alerts');
} catch (e) {
    console.log('BroadcastChannel not supported, using localStorage fallback');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('initializeApp called');
    // Check if user is already logged in
    const userData = localStorage.getItem('userData');
    console.log('User data from localStorage:', userData);
    if (userData) {
        console.log('User is already logged in, showing main screen');
        showMainScreen(JSON.parse(userData));
    } else {
        console.log('User is not logged in');
    }

    // Setup event listeners
    setupEventListeners();
    
    // Setup storage event listener for cross-tab communication
    window.addEventListener('storage', handleStorageChange);
    
    // Check if emergency tab is active by default
    console.log('Emergency tab element:', document.getElementById('emergency-tab'));
    console.log('SOS button element:', document.getElementById('sos-btn'));
    console.log('SOS sound element:', document.getElementById('sos-sound'));
}

function setupEventListeners() {
    console.log('setupEventListeners called');
    // Login form
    const kycForm = document.getElementById('kyc-form');
    if (kycForm) {
        kycForm.addEventListener('submit', handleLogin);
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Navigation tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Location sharing toggle
    const locationToggle = document.getElementById('location-toggle');
    if (locationToggle) {
        locationToggle.addEventListener('change', toggleLocationSharing);
    }

    // Share location button click handler
    const shareLocationBtn = document.getElementById('share-location-btn');
    if (shareLocationBtn) {
        shareLocationBtn.addEventListener('click', function(e) {
            // Prevent default if clicking on the button itself (not the toggle)
            if (e.target === shareLocationBtn || e.target.closest('.control-btn') === shareLocationBtn) {
                e.preventDefault();
                // Toggle the checkbox
                if (locationToggle) {
                    locationToggle.checked = !locationToggle.checked;
                    // Trigger the change event
                    locationToggle.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    // SOS button
    const sosBtn = document.getElementById('sos-btn');
    if (sosBtn) {
        console.log('SOS button found, setting up event listeners');
        sosBtn.addEventListener('click', (e) => {
            console.log('SOS button clicked - triggering immediately');
            triggerSOS();
        });
    } else {
        console.log('SOS button not found');
    }

    // Quick action buttons
    const sendPoliceBtn = document.getElementById('send-police-btn');
    const sendHospitalBtn = document.getElementById('send-hospital-btn');
    if (sendPoliceBtn) sendPoliceBtn.addEventListener('click', () => sendToFacility('police'));
    if (sendHospitalBtn) sendHospitalBtn.addEventListener('click', () => sendToFacility('hospital'));

    // Reminder form
    const reminderForm = document.getElementById('reminder-form');
    if (reminderForm) {
        reminderForm.addEventListener('submit', addReminder);
    }

    // Clear markers button
    const clearMarkersBtn = document.getElementById('clear-markers-btn');
    if (clearMarkersBtn) {
        clearMarkersBtn.addEventListener('click', clearAllMarkers);
    }
}

function handleLogin(e) {
    e.preventDefault();
    console.log('handleLogin called');
    
    const fullName = document.getElementById('full-name').value;
    const idNumber = document.getElementById('id-number').value;
    const kycCode = document.getElementById('kyc-code').value;
    const contact = document.getElementById('contact').value;

    // Mock authentication - in real app, this would validate with server
    if (fullName && idNumber && kycCode && contact) {
        console.log('Login successful, creating userData');
        const userData = {
            fullName,
            idNumber,
            kycCode,
            contact,
            blockchainId: generateBlockchainId(),
            loginTime: new Date().toISOString()
        };

        localStorage.setItem('userData', JSON.stringify(userData));
        showMainScreen(userData);
    } else {
        console.log('Login failed, missing fields');
    }
}

function handleLogout() {
    localStorage.removeItem('userData');
    localStorage.removeItem('reminders');
    if (locationSharing) {
        toggleLocationSharing();
    }
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('kyc-form').reset();
}

function showMainScreen(userData) {
    console.log('showMainScreen called with userData:', userData);
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    
    document.getElementById('user-name-display').textContent = userData.fullName;
    document.getElementById('blockchain-id').textContent = userData.blockchainId;
    
    // Initialize map
    initializeMap();
    
    // Load reminders
    loadReminders();
    
    // Try to get user's current location
    getCurrentLocation();
    
    // Check if emergency tab is active by default
    console.log('Emergency tab element:', document.getElementById('emergency-tab'));
    console.log('SOS button element:', document.getElementById('sos-btn'));
    console.log('SOS sound element:', document.getElementById('sos-sound'));
    console.log('User is logged in, emergency tab should be active');
    
    // Switch to emergency tab by default
    switchTab('emergency');
}

function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Refresh map if switching to map tab
    if (tabName === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
    
    // If switching to emergency tab, check if SOS button is present
    if (tabName === 'emergency') {
        console.log('Emergency tab active, SOS button:', document.getElementById('sos-btn'));
        console.log('SOS sound element:', document.getElementById('sos-sound'));
        console.log('Emergency tab content:', document.getElementById('emergency-tab'));
    }
}

function initializeMap() {
    if (map) return;
    
    map = L.map('map').setView([userLocation.lat, userLocation.lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add user marker
    updateUserMarker();
    
    // Add POI markers
    addPOIMarkers();
}

function updateUserMarker() {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
            html: '📍',
            className: 'custom-div-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        })
    }).addTo(map);
    
    userMarker.bindPopup(`
        <div class="poi-popup">
            <h4>Your Location</h4>
            <p>Current position</p>
        </div>
    `);
}

function addPOIMarkers() {
    // Add police station markers
    policeStations.forEach(station => {
        const marker = L.marker([station.lat, station.lng], {
            icon: L.divIcon({
                html: '🚔',
                className: 'custom-div-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <div class="poi-popup">
                <h4>${station.name}</h4>
                <p>Police Station</p>
            </div>
        `);
    });
    
    // Add hospital markers
    hospitals.forEach(hospital => {
        const marker = L.marker([hospital.lat, hospital.lng], {
            icon: L.divIcon({
                html: '🏥',
                className: 'custom-div-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <div class="poi-popup">
                <h4>${hospital.name}</h4>
                <p>Hospital</p>
            </div>
        `);
    });
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                if (map) {
                    map.setView([userLocation.lat, userLocation.lng], 13);
                    updateUserMarker();
                }
            },
            error => {
                console.log('Geolocation error:', error);
                // Keep default location (Bengaluru)
            }
        );
    }
}

function toggleLocationSharing() {
    locationSharing = !locationSharing;
    const shareLocationBtn = document.getElementById('share-location-btn');

    if (locationSharing) {
        // Add active class to button
        if (shareLocationBtn) {
            shareLocationBtn.classList.add('active');
        }

        // Start sharing location every 30 seconds
        locationInterval = setInterval(() => {
            getCurrentLocation();
            // Broadcast location update to admin
            broadcastLocationUpdate(userLocation);
            console.log('Location shared:', userLocation);
        }, 30000);
    } else {
        // Remove active class from button
        if (shareLocationBtn) {
            shareLocationBtn.classList.remove('active');
        }

        // Stop sharing location
        if (locationInterval) {
            clearInterval(locationInterval);
        }
    }
}

function triggerSOS() {
    console.log('triggerSOS called');
    if (sosActive) {
        console.log('SOS already active, returning');
        return;
    }
    
    sosActive = true;
    const userData = JSON.parse(localStorage.getItem('userData'));
    console.log('User data:', userData);
    console.log('SOS sound element:', document.getElementById('sos-sound'));
    console.log('SOS button element:', document.getElementById('sos-btn'));
    console.log('Emergency tab element:', document.getElementById('emergency-tab'));
    
    // Calculate nearest police station and hospital
    const nearestPolice = findNearest(policeStations, userLocation);
    const nearestHospital = findNearest(hospitals, userLocation);
    
    // Create SOS data with demo date/time (22-23 Sept 2025)
    sosData = {
        id: generateId(),
        userName: userData.fullName,
        idNumber: userData.idNumber,
        blockchainId: userData.blockchainId,
        contact: userData.contact,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        nearestPolice: nearestPolice,
        nearestHospital: nearestHospital,
        timestamp: getMockDate().toISOString(),
        status: 'pending',
        transactionHash: generateTransactionHash(),
        sentToPolice: false,
        sentToHospital: false
    };
    
    // Play SOS sound
    const sosSound = document.getElementById('sos-sound');
    if (sosSound) {
        console.log('Playing SOS sound');
        sosSound.play().catch(e => console.log('Audio play failed:', e));
    } else {
        console.log('SOS sound element not found');
    }
    
    // Save to localStorage
    const alerts = JSON.parse(localStorage.getItem('sosAlerts') || '[]');
    alerts.push(sosData);
    localStorage.setItem('sosAlerts', JSON.stringify(alerts));
    
    // Broadcast to admin
    broadcastSOSAlert(sosData);
    
    // Update UI
    displaySOSDetails();
    document.getElementById('quick-actions').style.display = 'block';
    
    // Add route lines to map
    if (map) {
        showRouteToNearest();
    }
    
    console.log('SOS Alert triggered:', sosData);
}

function findNearest(facilities, location) {
    let nearest = null;
    let minDistance = Infinity;
    
    facilities.forEach(facility => {
        const distance = calculateDistance(location, facility);
        facility.distance = distance;
        
        if (distance < minDistance) {
            minDistance = distance;
            nearest = { ...facility };
        }
    });
    
    return nearest;
}

function calculateDistance(pos1, pos2) {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function displaySOSDetails() {
    document.getElementById('sos-location').textContent = 
        `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
    document.getElementById('nearest-police').textContent = 
        `${sosData.nearestPolice.name} (${sosData.nearestPolice.distance.toFixed(2)} km)`;
    document.getElementById('nearest-hospital').textContent = 
        `${sosData.nearestHospital.name} (${sosData.nearestHospital.distance.toFixed(2)} km)`;
    document.getElementById('sos-hash').textContent = sosData.transactionHash;
    document.getElementById('sos-time').textContent = 
        new Date(sosData.timestamp).toLocaleString();
    
    document.getElementById('sos-details').style.display = 'block';
}

function showRouteToNearest() {
    if (!sosData) return;
    
    // Add polyline to nearest police station
    const policeRoute = L.polyline([
        [userLocation.lat, userLocation.lng],
        [sosData.nearestPolice.lat, sosData.nearestPolice.lng]
    ], {color: 'blue', weight: 3}).addTo(map);
    
    // Add polyline to nearest hospital
    const hospitalRoute = L.polyline([
        [userLocation.lat, userLocation.lng],
        [sosData.nearestHospital.lat, sosData.nearestHospital.lng]
    ], {color: 'red', weight: 3}).addTo(map);
}

function sendToFacility(type) {
    if (!sosData) return;
    
    if (type === 'police') {
        sosData.sentToPolice = true;
        document.getElementById('send-police-btn').innerHTML = 
            '<i class="fas fa-check"></i> Sent to Police';
        document.getElementById('send-police-btn').disabled = true;
    } else if (type === 'hospital') {
        sosData.sentToHospital = true;
        document.getElementById('send-hospital-btn').innerHTML = 
            '<i class="fas fa-check"></i> Sent to Hospital';
        document.getElementById('send-hospital-btn').disabled = true;
    }
    
    // Update localStorage
    const alerts = JSON.parse(localStorage.getItem('sosAlerts') || '[]');
    const alertIndex = alerts.findIndex(alert => alert.id === sosData.id);
    if (alertIndex !== -1) {
        alerts[alertIndex] = sosData;
        localStorage.setItem('sosAlerts', JSON.stringify(alerts));
    }
    
    // Broadcast update
    broadcastSOSAlert(sosData);
}

function broadcastSOSAlert(alertData) {
    console.log('Broadcasting SOS alert:', alertData);
    // Try BroadcastChannel first
    if (broadcastChannel) {
        try {
            broadcastChannel.postMessage({
                type: 'SOS_ALERT',
                data: alertData
            });
            console.log('SOS alert sent via BroadcastChannel');
            return; // Exit early if BroadcastChannel works
        } catch (e) {
            console.log('BroadcastChannel failed:', e);
        }
    }

    // Fallback: trigger storage event only if BroadcastChannel is not available
    console.log('Using localStorage fallback for SOS alert');
    localStorage.setItem('sosAlertBroadcast', JSON.stringify({
        timestamp: Date.now(),
        data: alertData
    }));
}

function broadcastLocationUpdate(locationData) {
    // Try BroadcastChannel first
    if (broadcastChannel) {
        try {
            broadcastChannel.postMessage({
                type: 'LOCATION_UPDATE',
                data: locationData
            });
        } catch (e) {
            console.log('BroadcastChannel failed for location:', e);
        }
    }
    
    // Fallback: trigger storage event
    localStorage.setItem('locationUpdateBroadcast', JSON.stringify({
        timestamp: Date.now(),
        data: locationData
    }));
}

function handleStorageChange(e) {
    if (e.key === 'sosAlertBroadcast') {
        // This is handled by admin dashboard
        console.log('Storage change detected:', e.newValue);
    }
}

function clearAllMarkers() {
    if (!map) return;

    // Remove all markers from the map
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Clear markers array if it exists
    if (window.markers) {
        window.markers = [];
    }

    // Re-add user marker
    updateUserMarker();

    // Re-add POI markers
    addPOIMarkers();

    // Show confirmation
    alert('All markers cleared successfully!');
}

// Travel Planner Functions
function addReminder(e) {
    e.preventDefault();
    
    const datetime = document.getElementById('reminder-datetime').value;
    const note = document.getElementById('reminder-note').value;
    
    if (datetime && note) {
        const reminder = {
            id: generateId(),
            datetime: datetime,
            note: note,
            created: new Date().toISOString()
        };
        
        const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        reminders.push(reminder);
        localStorage.setItem('reminders', JSON.stringify(reminders));
        
        loadReminders();
        document.getElementById('reminder-form').reset();
    }
}

function loadReminders() {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const container = document.getElementById('reminders-container');
    
    if (reminders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No reminders yet</p>';
        return;
    }
    
    // Sort reminders by datetime
    reminders.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    
    container.innerHTML = reminders.map(reminder => `
        <div class="reminder-item fadeIn">
            <div class="reminder-info">
                <div class="reminder-time">${new Date(reminder.datetime).toLocaleString()}</div>
                <div class="reminder-note">${reminder.note}</div>
            </div>
            <button class="remove-btn" onclick="removeReminder('${reminder.id}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeReminder(id) {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const filtered = reminders.filter(reminder => reminder.id !== id);
    localStorage.setItem('reminders', JSON.stringify(filtered));
    loadReminders();
}

// Utility Functions
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function generateBlockchainId() {
    const chars = '0123456789abcdef';
    let result = '0x';
    for (let i = 0; i < 40; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function generateTransactionHash() {
    const chars = '0123456789abcdef';
    let result = '0x';
    for (let i = 0; i < 64; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

// Mock date generator for demo (22-23 Sep 2025)
function getMockDate() {
    const start = new Date('2025-09-22T00:00:00');
    const end = new Date('2025-09-23T23:59:59');
    const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(randomTime);
}

// Initialize sample data for demo
function initializeSampleData() {
    // Create some sample SOS alerts for demo
    const sampleAlerts = [
        {
            id: generateId(),
            fullName: "Sample Tourist 1",
            idNumber: "AB1234567",
            blockchainId: generateBlockchainId(),
            contact: "+91-9876543210",
            location: { lat: 12.9716, lng: 77.5946 },
            nearestPolice: policeStations[0],
            nearestHospital: hospitals[0],
            timestamp: getMockDate().toISOString(),
            status: 'resolved',
            transactionHash: generateTransactionHash(),
            sentToPolice: true,
            sentToHospital: false
        }
    ];
    
    // Only add sample data if no alerts exist
    const existingAlerts = localStorage.getItem('sosAlerts');
    if (!existingAlerts) {
        localStorage.setItem('sosAlerts', JSON.stringify(sampleAlerts));
    }
}

// Initialize sample data when page loads
setTimeout(initializeSampleData, 1000);