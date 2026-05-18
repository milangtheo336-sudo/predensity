import { redirect } from 'next/navigation';

// Markets content now lives at the root URL (/).
// This redirect ensures old links to /markets still work.
export default function MarketsRedirect() {
  redirect('/');
}
