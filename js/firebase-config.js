/* Настройки Firebase и админа. Остаются теми же, что в старой версии сайта. */
const ADMIN_EMAIL = "evgen1285@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyADTLV0YpH3fGE-AXZsEv7z-bELtUU3rbk",
  authDomain: "narcissa-7b6a3.firebaseapp.com",
  projectId: "narcissa-7b6a3",
  storageBucket: "narcissa-7b6a3.firebasestorage.app",
  messagingSenderId: "643551780194",
  appId: "1:643551780194:web:5db51b3a37222a9301a03b",
  measurementId: "G-XM0RMYS0FJ"
};

let auth = null, db = null;
try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
} catch (e) { console.error("Firebase не загрузился:", e); }
