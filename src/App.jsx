import { useState, useEffect } from 'react';
import { auth } from './firebaseConfig'; // Importamos tu archivo de Firebase
import { onAuthStateChanged } from 'firebase/auth';
import MainLayout from './components/MainLayout';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchamos si el usuario entra o sale en Firebase
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-yellow-500">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <>
      {!user ? <Login /> : <MainLayout user={user} />}
    </>
  );
}

export default App;