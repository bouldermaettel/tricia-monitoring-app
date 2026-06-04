import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

afterEach(() => {
	cleanup();
});

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

if (!globalThis.ResizeObserver) {
	// jsdom does not implement ResizeObserver.
	globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
