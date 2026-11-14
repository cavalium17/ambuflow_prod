import {
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  linkWithPopup
} from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

// In-memory cache only (never stored in localStorage or sessionStorage)
let cachedGmailAccessToken: string | null = null;
let cachedGmailAccountEmail: string | null = null;

export const setGmailSessionToken = (token: string | null, email?: string | null) => {
  cachedGmailAccessToken = token || null;
  if (email !== undefined) {
    cachedGmailAccountEmail = email || null;
  }
};

export const clearGmailSessionToken = () => {
  cachedGmailAccessToken = null;
  cachedGmailAccountEmail = null;
};

export const hasGmailAccessToken = (): boolean => Boolean(cachedGmailAccessToken);

export const getGmailSessionEmail = (): string | null => cachedGmailAccountEmail;

export const authorizeGmailAccess = async (
  hintEmail?: string | null
): Promise<{ accessToken: string; email: string | null }> => {
  const provider = new GoogleAuthProvider();
  provider.addScope(GMAIL_SEND_SCOPE);
  provider.setCustomParameters({
    prompt: 'consent',
    ...(hintEmail ? { login_hint: hintEmail } : {})
  });

  // Also keep shared provider aligned
  googleProvider.addScope(GMAIL_SEND_SCOPE);

  const currentUser = auth.currentUser;
  let result;

  if (currentUser) {
    const hasGoogleProvider = currentUser.providerData.some((p) => p.providerId === 'google.com');
    if (hasGoogleProvider) {
      result = await reauthenticateWithPopup(currentUser, provider);
    } else {
      try {
        result = await linkWithPopup(currentUser, provider);
      } catch (err: any) {
        if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/provider-already-linked') {
          result = await signInWithPopup(auth, provider);
        } else {
          throw err;
        }
      }
    }
  } else {
    result = await signInWithPopup(auth, provider);
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;

  if (!accessToken) {
    throw new Error("Impossible de récupérer le jeton d'autorisation Gmail. Veuillez réessayer.");
  }

  const email = result.user?.email || hintEmail || null;
  setGmailSessionToken(accessToken, email);
  return { accessToken, email };
};

const encodeUtf8Base64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const toBase64Url = (rawBytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < rawBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...rawBytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const wrapBase6476 = (b64: string): string => {
  return b64.replace(/(.{76})/g, '$1\r\n');
};

export interface SendMonthlyPdfEmailParams {
  to: string;
  subject: string;
  bodyText: string;
  fileName: string;
  pdfBase64: string;
}

export const sendMonthlyPdfViaGmail = async ({
  to,
  subject,
  bodyText,
  fileName,
  pdfBase64
}: SendMonthlyPdfEmailParams): Promise<{ messageId: string }> => {
  if (!cachedGmailAccessToken) {
    throw new Error('GMAIL_AUTH_REQUIRED');
  }

  const cleanRecipient = to.trim();
  if (!cleanRecipient || !cleanRecipient.includes('@')) {
    throw new Error('Adresse e-mail destinataire invalide.');
  }

  const boundary = `ambuflow_boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const encodedSubject = `=?UTF-8?B?${encodeUtf8Base64(subject)}?=`;
  const encodedBody = wrapBase6476(encodeUtf8Base64(bodyText));
  const safeFileName = fileName.replace(/"/g, '');
  const cleanPdfBase64 = wrapBase6476(pdfBase64.replace(/\s+/g, ''));

  const mimeMessage = [
    `To: ${cleanRecipient}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${safeFileName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeFileName}"`,
    '',
    cleanPdfBase64,
    '',
    `--${boundary}--`,
    ''
  ].join('\r\n');

  const rawBytes = new TextEncoder().encode(mimeMessage);
  const raw = toBase64Url(rawBytes);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cachedGmailAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (response.status === 401 || response.status === 403) {
    clearGmailSessionToken();
    throw new Error('GMAIL_AUTH_REQUIRED');
  }

  if (!response.ok) {
    let errorDetail = `Erreur Gmail (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error?.message) {
        errorDetail = data.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail);
  }

  const result = await response.json();
  return { messageId: result.id || 'sent' };
};
