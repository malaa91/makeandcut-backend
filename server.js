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

// Route pour couper la vidéo AVEC CLOUDINARY
app.post('/api/cut-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    const { startTime, endTime } = req.body;
    const duration = endTime - startTime;

    console.log('✂️ Découpage vidéo demandé:', {
      startTime, 
      endTime, 
      duration,
      file: req.file.originalname,
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB'
    });

    // 1. Upload vers Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'video',
          folder: 'makeandcut',
          eager: [
            {
              start_offset: startTime.toString(),
              end_offset: endTime.toString(),
              quality: "auto",
              format: "mp4"
            }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ Erreur upload Cloudinary:', error);
            reject(error);
          } else {
            console.log('✅ Upload Cloudinary réussi:', result.public_id);
            resolve(result);
          }
        }
      ).end(req.file.buffer);
    });

    // 2. Vérifier que le traitement eager est terminé
    if (uploadResult.eager && uploadResult.eager[0]) {
      const processedVideo = uploadResult.eager[0];
      
      console.log('✅ Vidéo traitée:', {
        url: processedVideo.secure_url,
        format: processedVideo.format,
        size: processedVideo.bytes
      });

      // 3. Renvoyer le vrai fichier coupé
      res.json({ 
        success: true,
        message: '✅ Vidéo coupée avec succès !',
        downloadUrl: processedVideo.secure_url,
        details: {
          originalFile: req.file.originalname,
          cutFrom: startTime + 's',
          cutTo: endTime + 's',
          duration: duration.toFixed(2) + 's',
          outputSize: (processedVideo.bytes / 1024 / 1024).toFixed(2) + ' MB',
          outputFormat: processedVideo.format.toUpperCase()
        }
      });

    } else {
      // Fallback si eager n'est pas disponible
      const fallbackUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: 'video',
        transformation: [
          {
            flags: 'splice',
            variables: [
              `$start_${Math.floor(startTime)}`,
              `$end_${Math.floor(endTime)}`
            ]
          },
          { quality: 'auto', format: 'mp4' }
        ]
      });

      res.json({ 
        success: true,
        message: '✅ Vidéo coupée (méthode fallback) !',
        downloadUrl: fallbackUrl,
        details: {
          originalFile: req.file.originalname,
          cutFrom: startTime + 's',
          cutTo: endTime + 's',
          duration: duration.toFixed(2) + 's',
          note: 'Transformations Cloudinary en cours'
        }
      });
    }

  } catch (error) {
    console.error('❌ Erreur découpage:', error);
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

// ============ NOUVELLE ROUTE CORRIGÉE POUR DÉCOUPAGE MULTIPLE ============

app.post('/api/cut-video-multiple', upload.single('video'), async (req, res) => {
  console.log('🔄 NOUVELLE VERSION BACKEND APPELÉE - URL MANUELLE');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    const { cuts } = req.body;
    const cutsArray = JSON.parse(cuts);

    console.log('✂️ Découpage multiple demandé:', cutsArray);

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

    console.log('✅ Vidéo uploadée:', uploadResult.public_id);

    // 2. Générer les URLs avec la syntaxe CORRECTE Cloudinary
    const results = cutsArray.map((cut, index) => {
      try {
        const duration = cut.endTime - cut.startTime;
        
        // Construction MANUELLE de l'URL Cloudinary - SYNTAXE CORRECTE
        const publicId = uploadResult.public_id;
        const cloudName = 'dyogjyik0'; // Ton cloud name
        
        // Syntaxe Cloudinary correcte pour le découpage vidéo
        const videoUrl = `https://res.cloudinary.com/${cloudName}/video/upload/so_${cut.startTime.toFixed(2)},eo_${cut.endTime.toFixed(2)}/q_auto/f_mp4/${publicId}.mp4`;

        console.log(`📹 URL partie ${index + 1}:`, {
          start: cut.startTime,
          end: cut.endTime,
          url: videoUrl
        });

        return {
          success: true,
          name: cut.name || `Partie ${index + 1}`,
          downloadUrl: videoUrl,
          details: {
            startTime: cut.startTime,
            endTime: cut.endTime,
            duration: duration.toFixed(2) + 's'
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
    });

    // 3. Vérifier les résultats
    const successfulCuts = results.filter(r => r.success);
    
    if (successfulCuts.length === 0) {
      return res.status(500).json({ 
        error: 'Aucune coupe n\'a pu être générée',
        details: results.map(r => r.error) 
      });
    }

    // 4. Renvoyer les résultats
    res.json({ 
      success: true,
      message: `✅ Vidéo découpée en ${successfulCuts.length} partie(s) !`,
      results: results
    });

  } catch (error) {
    console.error('❌ Erreur découpage multiple:', error);
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

// Port dynamique pour Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur avec Stripe démarré sur le port ${PORT}`);
  console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configuré' : 'À configurer'}`);
  console.log(`Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configuré' : 'À configurer'}`);
});