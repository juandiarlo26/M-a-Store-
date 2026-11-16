import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
auth.languageCode = 'es';
export const storage = getStorage(app);
storage.maxUploadRetryTime = 5000;
storage.maxOperationRetryTime = 5000;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Por favor verifica tu configuración de Firebase: el cliente está sin conexión.');
      return false;
    }
    return true;
  }
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Registro con correo no disponible por ahora, usa Google';
    case 'auth/email-already-in-use':
      return 'Este correo ya está registrado. Ingresa con tu contraseña o recupérala si la olvidaste.';
    case 'auth/invalid-email':
      return 'Ingresa un correo electrónico válido.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    case 'auth/user-not-found':
      return 'No encontramos una cuenta registrada con ese correo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos en poco tiempo. Espera unos minutos antes de volver a intentarlo.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Revisa tu red e intenta nuevamente.';
    case 'auth/user-disabled':
      return 'Esta cuenta fue deshabilitada. Escríbenos por WhatsApp para ayudarte.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Se cerró la ventana de Google antes de completar el ingreso.';
    case 'auth/popup-blocked':
      return 'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes o regístrate con tu correo.';
    default:
      if (error instanceof Error && error.message && !error.message.startsWith('Firebase:')) {
        return error.message;
      }
      return 'No pudimos completar la autenticación en este momento. Intenta de nuevo.';
  }
}

export async function signInWithGoogle(): Promise<User> {
  auth.languageCode = 'es';
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signUpWithEmailPassword(
  name: string,
  email: string,
  password: string
): Promise<User> {
  auth.languageCode = 'es';
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = name.trim().slice(0, 100);
  if (cleanName) {
    try {
      await updateProfile(credential.user, { displayName: cleanName });
    } catch {
      // Non-fatal; displayName will also be stored in Firestore customer profile
    }
  }
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  auth.languageCode = 'es';
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function sendVerificationEmailToCurrentUser(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('No hay una sesión activa para reenviar el correo.');
  }
  auth.languageCode = 'es';
  await sendEmailVerification(auth.currentUser);
}

export async function requestPasswordReset(email: string): Promise<void> {
  auth.languageCode = 'es';
  await sendPasswordResetEmail(auth, email.trim());
}

export async function reloadCurrentFirebaseUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    await auth.currentUser.getIdToken(true);
  }
  return auth.currentUser;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}
