import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, appId };
}

export function hasFirebaseEnv() {
  return Boolean(getFirebaseConfig());
}

export function getFirebaseAuth() {
  const config = getFirebaseConfig();
  if (!config || typeof window === "undefined") {
    return null;
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

async function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Firebase の接続設定を確認してください。");
  }
  await setPersistence(auth, browserLocalPersistence);
  return auth;
}

export async function getFirebaseUser() {
  const auth = await requireAuth();
  await auth.authStateReady();
  return auth.currentUser;
}

export async function getFirebaseIdToken() {
  const user = await getFirebaseUser();
  return user ? user.getIdToken() : null;
}

export async function signInFirebaseWithGoogle() {
  const auth = await requireAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return (await signInWithPopup(auth, provider)).user;
}

export async function signInFirebaseWithEmail(email: string, password: string) {
  const auth = await requireAuth();
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function signUpFirebaseWithEmail(email: string, password: string, displayName: string) {
  const auth = await requireAuth();
  const user = (await createUserWithEmailAndPassword(auth, email, password)).user;
  await updateProfile(user, { displayName });
  await sendEmailVerification(user);
  return user;
}

export async function updateFirebaseDisplayName(user: User, displayName: string) {
  await updateProfile(user, { displayName });
}

export async function signOutFirebase() {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
}
