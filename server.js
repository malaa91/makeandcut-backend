const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary'); // AJOUT

const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
          folder: 'makeandcut',
          eager_async: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // 2. Transformation Cloudinary pour couper la vidéo
    const transformation = [
      { start_offset: startTime },
      { duration: duration },
      { quality: "auto", fetch_format: "mp4" }
    ];

    const cutVideoUrl = cloudinary.url(uploadResult.public_id, {
      resource_type: 'video',
      transformation: transformation,
      sign_url: true
    });

    // 3. Renvoyer le résultat
    res.json({ 
      success: true,
      message: '✅ Vidéo coupée avec succès!',
      downloadUrl: cutVideoUrl,
      details: {
        originalFile: req.file.originalname,
        cutFrom: startTime + 's',
        cutTo: endTime + 's',
        duration: duration.toFixed(2) + 's',
        outputFormat: 'MP4'
      }
    });

  } catch (error) {
    console.error('❌ Erreur Cloudinary:', error);
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

// Route pour créer une session de paiement Stripe
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, planName } = req.body;

    // Créer une session de checkout Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // ID du prix depuis Stripe Dashboard
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
      sessionId: session.id,
      url: session.url 
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

// Route webhook pour les événements Stripe (optionnel mais recommandé)
app.post('/api/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer les événements
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('✅ Paiement réussi:', session.id);
      // Ici tu peux mettre à jour ta base de données
      break;
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      console.log('❌ Abonnement annulé:', subscription.id);
      break;
    default:
      console.log(`🤔 Événement non géré: ${event.type}`);
  }

  res.json({received: true});
});