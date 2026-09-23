// Lumora — Home.
//
// This page is NOT protected. Guests browse it freely; authentication is
// required only when a prompt is submitted. The client island loads the
// sidebar's conversations from the real API itself (guests simply see none).
import { Suspense } from 'react';

import { Home } from '@/components/lumora/home';

export default function Page() {
  return (
    // Home reads the OAuth callback's status flag from the URL, so it needs a
    // Suspense boundary to stay statically renderable.
    <Suspense>
      <Home />
    </Suspense>
  );
}
