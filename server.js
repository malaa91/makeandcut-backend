const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary'); // AJOUT

const app = express();

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'test', // Remplacer par tes vraies clés
  api_key: process.env.CLOUDINARY_API_KEY || 'test',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'test'
});

// CORS
app.use(cors({
  origin: ['https://makeandcut-apwmfbhsu-mhamedtahir-2066s-projects.vercel.app', 'http://localhost:3000']
}));
app.use(express.json());

// Multer avec limite AUGMENTÉE grâce à Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB maintenant ! 🚀
  }
});

// Middleware pour logger les erreurs Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Fichier trop volumineux',
        message: 'Veuillez choisir une vidéo de moins de 50MB',
        maxSize: '50MB'
      });
    }
  }
  next(error);
});

// Route test
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut - Version Cloudinary 50MB!',
    status: 'OK',
    maxFileSize: '50MB',
    features: ['Upload vidéo', 'Stockage Cloudinary', 'Découpage simulé']
  });
});

// Route cut-video AVEC CLOUDINARY
app.post('/api/cut-video', upload.single('video'), async (req, res) => {
  try {
    console.log('📹 Fichier reçu:', {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size
    });

    if (!req.file) {
      return res.status(400).json({ 
        error: 'Aucun fichier reçu',
        hint: 'Veuillez sélectionner une vidéo'
      });
    }

    const { startTime, endTime } = req.body;

    // ✅ UPLOAD VERS CLOUDINARY
    console.log('☁️ Upload vers Cloudinary...');
    
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video',
          folder: 'makeandcut',
          eager: [
            { quality: "auto", fetch_format: "mp4" } // Optimisation auto
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ Erreur Cloudinary:', error);
            reject(error);
          } else {
            console.log('✅ Upload Cloudinary réussi:', result.public_id);
            resolve(result);
          }
        }
      ).end(req.file.buffer);
    });

    // SUCCÈS COMPLET !
    res.json({ 
      success: true,
      message: '✅ Vidéo uploadée et prête pour le découpage!',
      details: {
        filename: req.file.originalname,
        size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
        type: req.file.mimetype,
        cloudinaryUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        cutFrom: startTime + 's',
        cutTo: endTime + 's', 
        duration: (endTime - startTime).toFixed(2) + 's'
      },
      nextStep: 'Traitement vidéo réel avec Cloudinary Transformations'
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l upload Cloudinary',
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

    // Simulation durée - Cloudinary peut donner la vraie durée
    const mockDuration = Math.floor(Math.random() * 300) + 30; // 30-330 secondes
    
    res.json({
      success: true,
      duration: mockDuration,
      filename: req.file.originalname,
      fileSize: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      message: 'Info vidéo - Prêt pour le découpage Cloudinary'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur analyse vidéo' });
  }
});

// Port dynamique pour Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Cloudinary démarré sur le port ${PORT}`);
  console.log(`📁 Limite fichier: 50MB`);
  console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configuré' : 'À configurer'}`);
});