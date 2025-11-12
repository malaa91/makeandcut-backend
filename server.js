const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

// Autoriser les requêtes depuis ton frontend Vercel
app.use(cors({
  origin: ['https://makeandcut-apwmfbhsu-mhamedtahir-2066s-projects.vercel.app', 'http://localhost:3000']
}));

app.use(express.json());

// Configuration pour recevoir les fichiers
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
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Route test
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut est en marche !',
    version: '1.0.0',
    status: 'OK'
  });
});

// Route pour uploader une vidéo
app.post('/api/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    console.log('📹 Vidéo reçue:', req.file.filename);
    
    res.json({ 
      success: true,
      message: 'Vidéo uploadée avec succès !', 
      filename: req.file.filename,
      size: req.file.size,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur upload:', error);
    res.status(500).json({ error: 'Erreur lors de l upload' });
  }
});

// Route pour la santé de l'API
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur le port ${PORT}`);
  console.log(`📡 API disponible: http://localhost:${PORT}`);
});