import '@testing-library/jest-dom';

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

if (!globalThis.ResizeObserver) {
	// jsdom does not implement ResizeObserver.
	globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
