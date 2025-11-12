const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
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

// ============ ROUTES STRIPE ============

// Route pour créer une session de paiement Stripe
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, planName } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID manquant' });
    }

    // Créer une session de checkout Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        planName: planName
      }
    });

    res.json({ 
      success: true, 
      sessionId: session.id
    });

  } catch (error) {
    console.error('❌ Erreur Stripe:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la session de paiement',
      details: error.message 
    });
  }
});

// Route pour récupérer les infos d'une session
app.get('/api/checkout-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({ 
      success: true,
      session: {
        id: session.id,
        status: session.status,
        customer_email: session.customer_details?.email,
        plan: session.metadata?.planName
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération session:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la session' });
  }
});

// ============ ROUTES EXISTANTES ============

// Route test
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 API MakeAndCut avec Stripe!',
    status: 'OK',
    maxFileSize: '50MB',
    endpoints: ['/api/cut-video', '/api/video-info', '/api/create-checkout-session']
  });
});

// Route pour couper la vidéo AVEC CLOUDINARY
app.post('/api/cut-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    const { startTime, endTime } = req.body;
    const duration = endTime - startTime;

    console.log('✂️ Découpage vidéo demandé:', {
      startTime, endTime, duration,
      file: req.file.originalname
    });

    // 1. Upload vers Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video',
          folder: 'makeandcut'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // SIMULATION - Pour l'instant on retourne un succès sans vrai découpage
    res.json({ 
      success: true,
      message: '✅ Paramètres de découpage enregistrés!',
      details: {
        originalFile: req.file.originalname,
        cloudinaryId: uploadResult.public_id,
        cutFrom: startTime + 's',
        cutTo: endTime + 's',
        duration: duration.toFixed(2) + 's',
        note: 'Découpage réel à implémenter avec Cloudinary Transformations'
      }
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur lors du traitement vidéo',
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
    const mockDuration = Math.floor(Math.random() * 300) + 30;
    
    res.json({
      success: true,
      duration: mockDuration,
      filename: req.file.originalname,
      fileSize: (req.file.size / 1024 / 1024).toFixed(2) + ' MB'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur analyse vidéo' });
  }
});

// Port dynamique pour Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur avec Stripe démarré sur le port ${PORT}`);
  console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configuré' : 'À configurer'}`);
  console.log(`Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configuré' : 'À configurer'}`);
});