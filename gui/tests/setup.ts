import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock console methods to reduce test noise
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Mock DOM methods that might not be available in jsdom
Object.defineProperty(window, 'showDirectoryPicker', {
  value: jest.fn(),
  writable: true,
});

// Setup DOM
document.body.innerHTML = `
  <div id="app">
    <div id="searchInput"></div>
    <div id="artistFilter"></div>
    <div id="totalCharts"></div>
    <div id="selectedCount"></div>
    <div id="selectAll"></div>
    <div id="chartsGrid"></div>
    <div id="chartsList"></div>
    <div id="pagination"></div>
    <div id="currentPage"></div>
    <div id="totalPages"></div>
    <div id="prevPageBtn"></div>
    <div id="nextPageBtn"></div>
    <div id="statusMessage"></div>
    <div id="emptyState"></div>
  </div>
`;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});
