# DTX Download Manager - GUI Integration

## Overview

The DTX Download Manager now includes a modern web-based GUI that integrates with your existing CLI tools and backend services. The system provides both standalone operation and backend integration capabilities.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web GUI       │    │   API Server    │    │   Backend       │
│                 │    │                 │    │   Services      │
│ • React-like UI │◄──►│ • Express.js    │◄──►│ • ScrapingService│
│ • Modern UX     │    │ • REST API      │    │ • DownloadService│
│ • Responsive    │    │ • CORS enabled  │    │ • ChartDatabase │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Features

### ✅ Current Implementation
- **Modern Web GUI** - Professional responsive interface
- **Offline Mode** - Works without backend (localStorage fallback)
- **Online Mode** - Integrates with your existing services when available
- **Chart Management** - View, search, filter, and organize charts
- **Download Management** - Bulk downloads with progress tracking
- **Data Validation** - Proper title-artist matching and validation

### 🔄 Backend Integration Points
- **Scraping Service** - Connect to your existing `ScrapingService`
- **Download Service** - Use your optimized `DownloadService`
- **Database** - Integrate with your `ChartDatabase`
- **CLI Compatibility** - Works alongside existing CLI tools

## Quick Start

### 1. Start the Integrated System
```bash
npm run gui
```

This will:
- Build the TypeScript code
- Start the API server on http://localhost:3001
- Serve the GUI at http://localhost:3001/gui
- Provide API endpoints for integration

### 2. Development Mode
```bash
npm run gui:dev
```

This will:
- Watch for TypeScript changes
- Auto-restart the server
- Enable hot reloading for development

### 3. Access the GUI
- **Direct access**: http://localhost:3001
- **With GUI path**: http://localhost:3001/gui
- **API health check**: http://localhost:3001/api/health

## API Endpoints

The simple server provides these endpoints for frontend integration:

```
GET  /api/health           - Health check
GET  /api/charts           - List charts (placeholder)
POST /api/scrape           - Start scraping (placeholder)
POST /api/downloads        - Start download (placeholder)
```

## Integration Status

### ✅ Completed
- [x] Modern responsive web GUI
- [x] API server foundation
- [x] Offline/online mode detection  
- [x] Data validation and consistency
- [x] Progress tracking and status updates
- [x] Build system integration

### 🔄 In Progress (Next Steps)
- [ ] Connect scraping endpoints to `ScrapingService`
- [ ] Connect download endpoints to `DownloadService`  
- [ ] Integrate with `ChartDatabase`
- [ ] Add real-time progress updates via WebSockets
- [ ] Add authentication/authorization

### 🎯 Future Enhancements
- [ ] Chart preview/playback
- [ ] Batch operations
- [ ] Export/import functionality
- [ ] Advanced search and filtering
- [ ] Statistics and analytics

## File Structure

```
src/
├── api/
│   ├── server.ts          # Full-featured API server (WIP)
│   └── simple-server.ts   # Basic API server (current)
│
gui/
├── index.html            # Main GUI interface
├── styles.css            # Modern responsive styling
├── app.js               # Application logic
└── api-client.js        # API integration layer
```

## Usage Examples

### Starting the GUI
```bash
# Production mode
npm run gui

# Development mode with auto-reload
npm run gui:dev
```

### Using Existing CLI Tools
```bash
# Your existing CLI still works
npm run dtx:scrape
npm run dtx:search
npm run dtx:download
```

### API Integration
```javascript
// The GUI automatically detects backend availability
const apiClient = new DTXAPIClient();

// Online mode - uses backend API
await apiClient.getCharts();

// Offline mode - uses localStorage
// Automatically falls back when backend unavailable
```

## Configuration

The system is designed to work out-of-the-box with sensible defaults:

- **API Server**: http://localhost:3001
- **CORS**: Enabled for development origins
- **Storage**: Falls back to localStorage when offline
- **Build**: TypeScript compiled to `dist/`

## Troubleshooting

### Backend Not Available
- GUI automatically detects and shows "Working offline"
- All data stored in localStorage for persistence
- Can still import/export data manually

### Port Conflicts
```bash
# Change the port in simple-server.ts
server.start(3002); // Use different port
```

### Build Issues
```bash
# Clean build
npm run clean
npm run build
```

## Development

### Adding New Features
1. **Frontend**: Edit files in `gui/`
2. **Backend**: Edit files in `src/api/`
3. **Build**: Run `npm run build`
4. **Test**: Run `npm run gui:dev`

### API Integration Pattern
```javascript
// Check backend availability
await this.checkBackendConnection();

if (this.isOnline) {
    // Use backend API
    const result = await this.apiClient.scrapeCharts(params);
} else {
    // Fall back to local simulation
    const result = await this.simulateOperation(params);
}
```

This integration provides a smooth bridge between your existing CLI tools and a modern web interface, giving users the best of both worlds!
