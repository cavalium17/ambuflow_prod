
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase config
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// ID de la base de données spécifique (priorité au config file si présent)
const CUSTOM_DATABASE_ID = firebaseConfig.firestoreDatabaseId || 'ai-studio-bc6dd8d0-4580-4097-892c-7d8a2e1c3e27';

// Initialize Firebase Admin (Default App)
let adminApp;
const saVar = process.env.FIREBASE_SERVICE_ACCOUNT;

if (getApps().length === 0) {
  if (saVar) {
    try {
      const serviceAccount = JSON.parse(saVar);
      if (serviceAccount && serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || firebaseConfig.projectId
      });
      console.log(`Main Server: Initialized with service account for project ${serviceAccount.project_id || firebaseConfig.projectId}`);
    } catch (e: any) {
      console.error("Main Server: Failed to parse FIREBASE_SERVICE_ACCOUNT:", e.message);
      adminApp = initializeApp();
    }
  } else {
    console.warn("Main Server: FIREBASE_SERVICE_ACCOUNT is missing. To connect to your specific project '" + firebaseConfig.projectId + "', please add this secret in AI Studio settings.");
    adminApp = initializeApp();
  }
} else {
  adminApp = getApps()[0];
}

// Check database connection and initialization
let db: any;
try {
  db = getFirestore(adminApp, CUSTOM_DATABASE_ID);
  console.log(`Main Server: Firestore initialized for database ${CUSTOM_DATABASE_ID}`);
} catch (e: any) {
  console.error(`Main Server: CRITICAL - Failed to initialize Firestore with ID ${CUSTOM_DATABASE_ID}:`, e.message);
  // Fallback to default database to avoid total crash if possible, or re-throw
  db = getFirestore(adminApp);
}
const authAdmin = getAuth(adminApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/test', (req, res) => {
    res.json({ message: "Hello from AmbuFlow API" });
  });

  // SAVE PLANNING
  app.post('/api/save-planning', async (req, res) => {
    try {
      const { userId, planning } = req.body;
      if (!userId || !planning) {
        return res.status(400).json({ error: "userId and planning are required" });
      }

      console.log(`Saving planning for ${userId} to db ${CUSTOM_DATABASE_ID}`);
      
      await db.collection('users').doc(userId).set({
        planning: planning,
        lastPlanningUpdate: FieldValue.serverTimestamp()
      }, { merge: true });

      res.status(200).json({ success: true, message: "Planning saved successfully" });
    } catch (error: any) {
      console.error("Planning Save Error:", error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
