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
	globalThis.ResizeObserver = ResizeObserverMock;
}
