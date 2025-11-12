const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();

// CORS
app.use(cors({
  origin: ['https://makeandcut-apwmfbhsu-mhamedtahir-2066s-projects.vercel.app', 'http://localhost:3000']
}));
app.use(express.json());

// Multer avec limite TRÈS petite pour tester
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 2 * 1024 * 1024 // SEULEMENT 2MB pour tester
  }
});

// Middleware pour logger les erreurs Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Fichier trop volumineux',
        message: 'Veuillez choisir une vidéo de moins de 2MB pour le test',
        maxSize: '2MB'
      });
    }
  }
  next(error);
});

// Route test
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut - Version 2MB limite',
    status: 'OK',
    maxFileSize: '2MB'
  });
});

// Route cut-video
app.post('/api/cut-video', upload.single('video'), (req, res) => {
  try {
    console.log('📹 Fichier reçu:', {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size
    });

    if (!req.file) {
      return res.status(400).json({ 
        error: 'Aucun fichier reçu',
        hint: 'Assurez-vous que le fichier fait moins de 2MB'
      });
    }

    const { startTime, endTime } = req.body;

    // SUCCÈS !
    res.json({ 
      success: true,
      message: '✅ Vidéo reçue avec succès!',
      details: {
        filename: req.file.originalname,
        size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
        type: req.file.mimetype,
        cutFrom: startTime + 's',
        cutTo: endTime + 's',
        duration: (endTime - startTime).toFixed(2) + 's'
      },
      nextStep: 'Traitement vidéo à implémenter'
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
});

// Route video-info
app.post('/api/video-info', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    // Simulation durée
    const mockDuration = 60;
    
    res.json({
      success: true,
      duration: mockDuration,
      filename: req.file.originalname,
      fileSize: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      message: 'Info vidéo - Prêt pour le découpage'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur analyse vidéo' });
  }
});

// Port dynamique pour Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});