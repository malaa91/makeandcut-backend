const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

// Middleware CORS
app.use(cors({
  origin: ['https://makeandcut-apwmfbhsu-mhamedtahir-2066s-projects.vercel.app', 'http://localhost:3000']
}));
app.use(express.json());

// Configuration Multer SIMPLIFIÉE
const storage = multer.memoryStorage(); // Utilise la mémoire au lieu du disque
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Route test
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut avec upload!',
    status: 'OK'
  });
});

// Route cut-video AVEC UPLOAD
app.post('/api/cut-video', upload.single('video'), (req, res) => {
  try {
    console.log('📹 Requête reçue:', {
      body: req.body,
      file: req.file ? {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      } : 'Aucun fichier'
    });

    if (!req.file) {
      return res.status(400).json({ error: '❌ Aucune vidéo reçue' });
    }

    const { startTime, endTime } = req.body;

    // Simulation de traitement réussi
    res.json({ 
      success: true,
      message: '✅ Vidéo reçue et paramètres enregistrés!',
      details: {
        filename: req.file.originalname,
        fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
        fileType: req.file.mimetype,
        cutFrom: startTime + 's',
        cutTo: endTime + 's', 
        duration: (endTime - startTime).toFixed(2) + 's',
        nextStep: 'FFmpeg à installer'
      }
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// Route video-info AVEC UPLOAD
app.post('/api/video-info', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    // Simulation - on pourrait utiliser ffprobe plus tard
    const mockDuration = 120; // 120 secondes pour test
    
    res.json({
      success: true,
      duration: mockDuration,
      filename: req.file.originalname,
      fileSize: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
      message: 'Info vidéo simulée - Durée réelle avec FFmpeg plus tard'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur analyse vidéo' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Serveur avec upload démarré sur le port ${PORT}`);
});