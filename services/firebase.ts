
import { getFirestore } from "firebase/firestore";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBWsMjj_aCLCop2v8I-ST97D6hVE1aV2Gg",
  authDomain: "examapp1-59270.firebaseapp.com",
  projectId: "examapp1-59270",
  storageBucket: "examapp1-59270.firebasestorage.app",
  messagingSenderId: "1013120873082",
  appId: "1:1013120873082:web:b83622611c121a2f92c1c3",
  measurementId: "G-FF04K5087Z"
};

// Initialize Firebase (Compat) - ensures singleton
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export Modular Firestore using the initialized app
export const db = getFirestore(firebase.app());

// Export Compat Auth
export const auth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
