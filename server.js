const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();

app.use(cors());
app.use(express.json());

// Configuration upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// Route TEMPORAIRE sans FFmpeg - pour tester
app.post('/api/cut-video', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    const { startTime, endTime } = req.body;
    
    console.log('📹 Vidéo reçue:', {
      filename: req.file.originalname,
      size: req.file.size,
      startTime: startTime,
      endTime: endTime
    });

    // SIMULATION - FFmpeg à configurer plus tard
    res.json({ 
      success: true,
      message: '✅ Paramètres reçus - Simulation réussie!',
      details: {
        originalFile: req.file.originalname,
        cutFrom: startTime + 's',
        cutTo: endTime + 's',
        duration: (endTime - startTime) + 's',
        status: 'FFmpeg à installer sur Render'
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// Route pour infos vidéo (temporaire aussi)
app.post('/api/video-info', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    // Simulation de la durée
    const mockDuration = 60; // 60 secondes pour tester
    
    res.json({
      duration: mockDuration,
      filename: req.file.originalname,
      size: req.file.size,
      message: 'Info vidéo simulée - FFmpeg à installer'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur analyse vidéo' });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut - Version Simulation',
    version: '2.0.0',
    status: 'En attente de FFmpeg',
    endpoints: ['/api/cut-video', '/api/video-info']
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Serveur de simulation démarré sur le port ${PORT}`);
});