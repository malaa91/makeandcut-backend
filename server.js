const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const users = new Map(); // En mémoire - à remplacer par une DB plus tard

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
      sessionId: session.id,
      url: session.url  // IMPORTANT : Retourne l'URL de checkout
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


app.post('/api/cut-video-multiple', upload.single('video'), async (req, res) => {
  console.log('🎯 Découpage multiple - Version corrigée');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    const { cuts } = req.body;
    const cutsArray = JSON.parse(cuts);

    console.log('✂️ Découpage multiple demandé:', cutsArray.length, 'parties');

    // 1. Upload vers Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video',
          folder: 'makeandcut',
          eager: cutsArray.map((cut, index) => ({
            transformation: [
              {
                flags: `splice:${cut.startTime.toFixed(2)}_${cut.endTime.toFixed(2)}`,
                format: 'mp4',
                quality: 'auto'
              }
            ]
          }))
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    console.log('✅ Vidéo uploadée. Public ID:', uploadResult.public_id);

    // 2. Méthode ALTERNATIVE plus fiable : Créer chaque partie individuellement
    const results = await Promise.all(
      cutsArray.map(async (cut, index) => {
        try {
          console.log(`🔄 Génération partie ${index + 1}: ${cut.startTime}s à ${cut.endTime}s`);
          
          // Générer l'URL de transformation Cloudinary
          const transformationUrl = cloudinary.url(uploadResult.public_id, {
            resource_type: 'video',
            transformation: [
              { start_offset: cut.startTime },
              { end_offset: cut.endTime },
              { quality: 'auto', format: 'mp4' }
            ]
          });

          console.log(`✅ URL partie ${index + 1}:`, transformationUrl);

          return {
            success: true,
            name: cut.name || `Partie ${index + 1}`,
            downloadUrl: transformationUrl,
            details: {
              startTime: cut.startTime,
              endTime: cut.endTime,
              duration: (cut.endTime - cut.startTime).toFixed(2) + 's'
            }
          };
        } catch (error) {
          console.error(`❌ Erreur partie ${index + 1}:`, error);
          return {
            success: false,
            name: cut.name || `Partie ${index + 1}`,
            error: error.message
          };
        }
      })
    );

    // 3. Vérifier si toutes les parties ont été générées
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return res.status(500).json({ 
        error: 'Aucune partie n\'a pu être générée',
        details: results 
      });
    }

    console.log(`✅ ${successfulResults.length}/${results.length} parties générées avec succès`);

    res.json({ 
      success: true,
      message: `✅ Vidéo découpée en ${successfulResults.length} partie(s) !`,
      results: successfulResults
    });

  } catch (error) {
    console.error('❌ Erreur globale:', error);
    res.status(500).json({ 
      error: 'Erreur lors du découpage multiple', 
      details: error.message 
    });
  }
});

// ============ ROUTES UTILISATEUR ============

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (users.has(email)) {
    return res.status(400).json({ error: 'Utilisateur existe déjà' });
  }

  users.set(email, { email, password, plan: 'free', videosProcessed: 0 });
  res.json({ success: true, message: 'Compte créé' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  res.json({ 
    success: true, 
    user: { 
      email: user.email, 
      plan: user.plan,
      videosProcessed: user.videosProcessed 
    } 
  });
});

// Génération automatique de sous-titres
app.post('/api/generate-subtitles', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    // 1. Upload vers Cloudinary pour transcription
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video',
          folder: 'makeandcut',
          raw_convert: 'google_speech' // Transcription automatique
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // 2. Récupérer les sous-titres générés
    const subtitles = await generateSubtitlesFromVideo(uploadResult.public_id);
    
    res.json({
      success: true,
      subtitles: subtitles.map((sub, index) => ({
        id: Date.now() + index,
        text: sub.text,
        startTime: sub.start,
        endTime: sub.end,
        confidence: sub.confidence
      }))
    });

  } catch (error) {
    console.error('Erreur génération sous-titres:', error);
    res.status(500).json({ error: 'Erreur génération sous-titres' });
  }
});

// Export avec overlays
app.post('/api/export-with-overlays', upload.single('video'), async (req, res) => {
  try {
    const { subtitles, textOverlays } = req.body;
    const overlays = JSON.parse(textOverlays);

    // Upload vidéo originale
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'makeandcut' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Générer les transformations Cloudinary pour les overlays
    let transformation = '';
    
    textOverlays.forEach((overlay, index) => {
      transformation += `l_text:${overlay.styles.fontFamily}_${overlay.styles.fontSize}:${encodeURIComponent(overlay.text)},co_${overlay.styles.color.replace('#', '')},bga_${overlay.styles.backgroundColor.replace('rgba(', '').replace(')', '')}/fl_layer_apply,so_${overlay.startTime},eo_${overlay.endTime}/`;
    });

    const finalUrl = `https://res.cloudinary.com/dyogjyik0/video/upload/${transformation}q_auto/f_mp4/${uploadResult.public_id}.mp4`;

    res.json({
      success: true,
      downloadUrl: finalUrl,
      message: 'Vidéo exportée avec overlays'
    });

  } catch (error) {
    console.error('Erreur export:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// Fonction helper pour générer les sous-titres
async function generateSubtitlesFromVideo(publicId) {
  // Implémentation avec l'API Cloudinary ou service externe
  // Pour l'exemple, retourne des données mock
  return [
    {
      text: "Bonjour et bienvenue dans cette vidéo",
      start: 0,
      end: 3,
      confidence: 0.95
    },
    {
      text: "Aujourd'hui nous allons découvrir de nouvelles fonctionnalités",
      start: 3,
      end: 7,
      confidence: 0.89
    }
  ];
}

// Port dynamique pour Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur avec Stripe démarré sur le port ${PORT}`);
  console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configuré' : 'À configurer'}`);
  console.log(`Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configuré' : 'À configurer'}`);
});