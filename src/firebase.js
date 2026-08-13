import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAmIKYxDd4JmZ0ejh6uOCs45kx6wGzfNUE",
  authDomain: "fantasy-vault-4f8da.firebaseapp.com",
  projectId: "fantasy-vault-4f8da",
  storageBucket: "fantasy-vault-4f8da.firebasestorage.app",
  messagingSenderId: "783166496442",
  appId: "1:783166496442:web:18e89d2512d6f37c04ac83",
  measurementId: "G-CQC5Y464MV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
