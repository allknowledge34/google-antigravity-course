import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { dark } from '@clerk/themes';
import App from './App.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY} 
      afterSignOutUrl="/"
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#0891b2',
          colorBackground: '#1e293b',
          colorText: '#f8fafc',
          colorTextSecondary: '#94a3b8',
          colorInputBackground: '#0f172a',
          colorInputText: '#f8fafc',
          colorDanger: '#ef4444',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
        },
        elements: {
          card: {
            backgroundColor: '#1e293b',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #334155',
          },
          headerTitle: {
            color: '#f8fafc',
          },
          headerSubtitle: {
            color: '#94a3b8',
          },
          socialButtonsBlockButton: {
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            color: '#f8fafc',
          },
          socialButtonsBlockButtonText: {
            color: '#f8fafc',
          },
          formButtonPrimary: {
            backgroundColor: '#0891b2',
            color: '#ffffff',
          },
          formFieldLabel: {
            color: '#e2e8f0',
          },
          formFieldInput: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            color: '#f8fafc',
          },
          dividerLine: {
            backgroundColor: '#334155',
          },
          dividerText: {
            color: '#94a3b8',
          },
          footerActionText: {
            color: '#94a3b8',
          },
          footerActionLink: {
            color: '#0891b2',
          },
          identityPreviewText: {
            color: '#f8fafc',
          },
          identityPreviewEditButtonIcon: {
            color: '#0891b2',
          }
        }
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
