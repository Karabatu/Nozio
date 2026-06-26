import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service Worker für PWA Offline-Fähigkeit registrieren
// import.meta.env.PROD statt process.env.NODE_ENV (Vite-kompatibel)
// import.meta.env.BASE_URL stellt korrekte Pfade bei GitHub Pages Sub-Paths sicher
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        console.log('Nozio Service Worker erfolgreich registriert:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker Registrierung fehlgeschlagen:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
