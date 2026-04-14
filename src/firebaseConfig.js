import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Estos son los datos que copiaste de la consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCGhhv5HXLYkPY-pkpyONkCX96W2dFRuBg",
  authDomain: "ec-plataforma.firebaseapp.com",
  projectId: "ec-plataforma",
  storageBucket: "ec-plataforma.firebasestorage.app",
  messagingSenderId: "825471376058",
  appId: "1:825471376058:web:4bd00ca055444a56fa0083",
  measurementId: "G-FDYGFBS3Q7"
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

// Exportamos la autenticación para usarla en el Login
export const auth = getAuth(app);