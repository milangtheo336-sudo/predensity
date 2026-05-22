import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Hashgraph React Wallets doesn't use web components
    }
  }
}

// Ensures file is treated as a module
export {};
