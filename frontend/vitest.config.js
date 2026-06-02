import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const lowMemoryMode = process.env.VITEST_LOW_MEMORY === '1';

export default defineConfig({
    plugins: [react()],
    resolve: {
        extensions: ['.mjs', '.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        globals: true,
        ...(lowMemoryMode
            ? {
                // Single-process test execution to reduce worker heap pressure.
                pool: 'forks',
                poolOptions: {
                    forks: {
                        singleFork: true,
                    },
                },
                fileParallelism: false,
            }
            : {}),
    },
});
