const express = require('express');
const cors = require('cors');

const app = express();

// Middleware CORS pour autoriser ton frontend
app.use(cors({
  origin: ['https://makeandcut-apwmfbhsu-mhamedtahir-2066s-projects.vercel.app', 'http://localhost:3000']
}));
app.use(express.json());

// Route test simple
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut WORKING!',
    timestamp: new Date().toISOString(),
    status: 'OK'
  });
});

// Route cut-video SIMPLIFIÉE
app.post('/api/cut-video', (req, res) => {
  console.log('✅ Route /api/cut-video appelée!');
  
  res.json({ 
    success: true,
    message: '🎉 Route /api/cut-video fonctionne!',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// Route video-info SIMPLIFIÉE
app.post('/api/video-info', (req, res) => {
  res.json({
    duration: 120,
    message: 'Info vidéo simulée'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Serveur SUPER SIMPLE démarré sur le port ${PORT}`);
});