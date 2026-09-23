import { AuthProvider } from '@/lib/auth/auth-provider';
import { ChatHistoryProvider } from '@/lib/conversation/chat-history-provider';
import { LocaleGate } from '@/lib/i18n/locale-gate';

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.LUMORA_SITE_URL || 'http://localhost:3000'),
  title: 'Lumora — Decision Intelligence',
  description:
    'Lumora helps you research products, compare the top options, and choose with confidence through a calm, decision-intelligent experience.',
  // Brand imagery is handled by the App Router file conventions:
  // `app/icon.svg`, `app/apple-icon.png`, `app/opengraph-image.png`, and
  // `app/twitter-image.png`.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Edge-to-edge on notched phones; the shell pads with safe-area insets.
  viewportFit: 'cover',

  interactiveWidget: 'resizes-content',
  themeColor: '#f6f5ee',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang/dir start at the English default and are corrected on the client
    // once the account's language is known. They live on <html> because the
    // browser's own text handling, native controls and assistive technology all
    // read them there — scoping direction to a wrapper leaves scrollbars and
    // form controls on the wrong side.
    <html
      lang="en"
      dir="ltr"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="h-full antialiased">
        {/* Session state for the app, plus the sidebar's conversation-list
            cache — at the root so it survives every navigation, including
            Home ↔ /chat/*. This layout stays a Server Component; the
            providers are the client boundary. */}
        <AuthProvider>
          <LocaleGate>
            <ChatHistoryProvider>{children}</ChatHistoryProvider>
          </LocaleGate>
        </AuthProvider>
      </body>
    </html>
  );
}
