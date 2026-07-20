import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCJXht8amZYkTpfI6ksI-ZzFJImaXifMag',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'spendsmart-8d997.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'spendsmart-8d997',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  const idToken = await result.user.getIdToken()
  return idToken
}

export async function firebaseSignOut() {
  await signOut(auth)
}
