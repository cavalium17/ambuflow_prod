import admin from 'firebase-admin';

// ID de votre base de données spécifique
const DATABASE_ID = 'ai-studio-bc6dd8d0-4580-4097-892c-7d8a2e1c3e27';

// 1. Initialisation de Firebase Admin
if (!admin.apps.length) {
  try {
    const saVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saVar) {
      const serviceAccount = JSON.parse(saVar);
      if (serviceAccount && serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'ambuflow-e5ffc'
      });
      console.log(`Planning API: Initialized with project ${serviceAccount.project_id || 'ambuflow-e5ffc'}`);
    } else {
      console.warn("Planning API: FIREBASE_SERVICE_ACCOUNT missing, falling back to ADC.");
      admin.initializeApp();
    }
  } catch (error) {
    console.error("Erreur fatale initialisation Firebase Admin (Planning):", error.message);
  }
}

// Instance Firestore spécifique
const db = admin.firestore(DATABASE_ID);

export default async function handler(req, res) {
  // Forcer le JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    // Vérification de la méthode
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: "Méthode non autorisée", 
        message: "Utilisez POST pour enregistrer votre planning" 
      });
    }

    // Récupération des données du corps de la requête
    const { userId, planning } = req.body;

    // Validation basique
    if (!userId) {
      return res.status(400).json({ error: "Validation échouée", message: "userId est requis" });
    }

    if (!planning) {
      return res.status(400).json({ error: "Validation échouée", message: "Les données de planning sont absentes" });
    }

    console.log(`Tentative de sauvegarde du planning pour ${userId} sur la base ${DATABASE_ID}`);

    // Sauvegarde avec Merge pour ne rien écraser d'autre dans le profil utilisateur
    try {
      await db.collection('users').doc(userId).set({ 
        planning: planning,
        lastPlanningUpdate: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.status(200).json({ 
        success: true, 
        message: "Planning enregistré avec succès dans votre profil" 
      });
    } catch (saveError) {
      console.error("Erreur Firestore lors de la sauvegarde du planning:", saveError.message);
      return res.status(500).json({ 
        error: "Erreur Base de Données", 
        message: "Impossible d'enregistrer le planning",
        details: saveError.message
      });
    }

  } catch (error) {
    console.error("Erreur serveur handler planning:", error.message);
    return res.status(500).json({ 
      error: "Erreur Serveur Interne", 
      message: error.message 
    });
  }
}
