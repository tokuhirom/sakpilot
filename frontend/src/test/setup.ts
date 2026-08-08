import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// uPlot(MetricGraph/ProxyLBConnectionGraph)がマウント時に参照するためjsdomに用意する
window.matchMedia = window.matchMedia || function (query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
};

afterEach(() => {
  cleanup();
});
