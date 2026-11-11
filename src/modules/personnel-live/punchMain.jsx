import { createRoot } from 'react-dom/client';
import PunchApp from './PunchApp';
// Separate Vite entry: no Supabase Auth, Personnel admin, roster or prototype imports.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/personal/fichaje/sw.js', { scope: '/personal/fichaje/' }).catch(() => {});
createRoot(document.getElementById('root')).render(<PunchApp />);
