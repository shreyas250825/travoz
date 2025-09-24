const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for alerts (for demo purposes)
let alerts = [];

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send existing alerts to newly connected admin clients
  socket.on('join-admin', () => {
    console.log('Admin client joined:', socket.id);
    socket.emit('existing-alerts', alerts);
  });

  // Handle user location updates
  socket.on('location-update', (data) => {
    console.log('Location update received:', data);
    // Broadcast to all admin clients
    socket.broadcast.emit('location-update', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API endpoint to receive SOS alerts from user app
app.post('/sos-alert', (req, res) => {
  try {
    const alertData = req.body;

    // Add timestamp if not provided
    if (!alertData.timestamp) {
      alertData.timestamp = new Date().toISOString();
    }

    // Add unique ID if not provided
    if (!alertData.id) {
      alertData.id = 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Store the alert
    alerts.push(alertData);
    console.log('SOS Alert received:', alertData);

    // Broadcast to all connected admin clients
    io.emit('new-sos-alert', alertData);

    res.status(200).json({
      success: true,
      message: 'SOS Alert received successfully',
      alertId: alertData.id
    });
  } catch (error) {
    console.error('Error processing SOS alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing SOS alert'
    });
  }
});

// API endpoint to fetch all alerts (for admin dashboard)
app.get('/alerts', (req, res) => {
  res.json({
    success: true,
    alerts: alerts,
    total: alerts.length
  });
});

// API endpoint to update alert status
app.put('/alerts/:id', (req, res) => {
  const alertId = req.params.id;
  const updateData = req.body;

  const alertIndex = alerts.findIndex(alert => alert.id === alertId);

  if (alertIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  // Update the alert
  alerts[alertIndex] = { ...alerts[alertIndex], ...updateData };

  // Broadcast the update to all admin clients
  io.emit('alert-updated', alerts[alertIndex]);

  res.json({
    success: true,
    message: 'Alert updated successfully',
    alert: alerts[alertIndex]
  });
});

// API endpoint to delete an alert
app.delete('/alerts/:id', (req, res) => {
  const alertId = req.params.id;

  const alertIndex = alerts.findIndex(alert => alert.id === alertId);

  if (alertIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }

  // Remove the alert
  const deletedAlert = alerts.splice(alertIndex, 1)[0];

  // Broadcast the deletion to all admin clients
  io.emit('alert-deleted', alertId);

  res.json({
    success: true,
    message: 'Alert deleted successfully',
    deletedAlert: deletedAlert
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    alertsCount: alerts.length
  });
});

// Favicon endpoint to prevent 404 errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Alerts API: http://localhost:${PORT}/alerts`);
  console.log(`SOS Alert endpoint: POST http://localhost:${PORT}/sos-alert`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Render deployment URL: https://travoz.onrender.com`);
});
