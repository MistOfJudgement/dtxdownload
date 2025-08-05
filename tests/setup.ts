/**
 * Jest setup for E2E tests
 */

// Set reasonable timeout for E2E tests
jest.setTimeout(50000); // Reduced from 60s to 50s default timeout

// Global test setup
beforeAll(() => {
  console.log('🧪 Starting E2E test suite...');
});

afterAll(async () => {
  console.log('✅ E2E test suite completed.');
  
  // Give a small delay for any async cleanup
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Force cleanup of any remaining handles
  if (global.gc) {
    global.gc();
  }
});

// Add custom matchers if needed
expect.extend({
  toBeValidChart(received) {
    const pass = received && 
                 typeof received.id === 'string' &&
                 typeof received.title === 'string' &&
                 typeof received.artist === 'string' &&
                 typeof received.bpm === 'string' &&
                 Array.isArray(received.difficulties) &&
                 typeof received.downloadUrl === 'string';
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid chart`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid chart with required fields`,
        pass: false,
      };
    }
  },
});

export {}; // Make this file a module
