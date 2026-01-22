import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEN6iWDFbkkUmw0smctVG0CPz9oBEkI5Q",
  authDomain: "mind-docs.firebaseapp.com",
  projectId: "mind-docs",
  storageBucket: "mind-docs.firebasestorage.app",
  messagingSenderId: "481075696854",
  appId: "1:481075696854:web:b523037749514c7efaa577",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
