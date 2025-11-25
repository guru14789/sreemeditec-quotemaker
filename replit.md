# SREE MEDITEC Quotation Generator

## Overview

A Progressive Web Application (PWA) for generating, managing, and downloading professional medical equipment quotations. The application enables users to create quotations with auto-fill capabilities for clients and products, manage quotation history, and export to PDF format. Built with React and TypeScript, it features offline functionality through service workers and cloud synchronization via Firebase.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Language**
- React 18.2.0 with TypeScript for type-safe component development
- Functional components with React Hooks for state management
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)

**State Management**
- Local component state using useState for UI interactions
- Custom hooks for cross-cutting concerns:
  - `useLocalStorage`: Persistent client-side storage with automatic serialization
  - `useDebounce`: Performance optimization for search and autocomplete features
- React refs (useRef) for managing previous state comparisons and DOM references

**UI/UX Design Patterns**
- Responsive design with mobile-first approach (mobile view switcher between form/preview)
- Tab-based navigation for right panel (preview, history, product list)
- Autocomplete/suggestion system for clients and products
- Real-time preview of quotation data
- Debounced search functionality to minimize re-renders

**Component Structure**
- `App.tsx`: Main container managing global state and orchestrating child components
- `QuotationPreview.tsx`: Read-only display of quotation with formatting and calculations
- `QuotationHistory.tsx`: List view with search, load, delete, and re-download capabilities
- `ProductList.tsx`: CRUD interface for managing product catalog with inline editing

### Data Storage Solutions

**Client-Side Storage**
- LocalStorage for persistent data:
  - Clients list with name, address, and GST details
  - Products catalog with specifications, pricing, and GST rates
  - Last used reference number for auto-incrementing quotations
  - Individual quotation drafts
- Service Worker cache for offline PWA functionality (caches essential app shell files)

**Cloud Storage**
- Firebase Firestore for cloud synchronization:
  - Quotations collection with document ID as reference number
  - Server timestamps for created/updated tracking
  - Query optimization with ordering and limits (50 most recent)
  - Merge strategy for updates to preserve existing data

**Data Models**
- Normalized structure separating clients, products, and quotations
- Computed values (totals, GST) calculated on-the-fly rather than stored
- Legacy format support for backward compatibility with discount calculations

### PDF Generation

**Library & Implementation**
- jsPDF for document creation with custom formatting
- jspdf-autotable for tabular product listings
- Multi-page support with automatic overflow handling
- Calculations performed at generation time:
  - Gross total, discounts, GST per product, freight charges
  - Grand total with number-to-words conversion (Indian numbering system)

**Document Features**
- Configurable company logo or text header
- Client details, reference number, and date
- Itemized product table with specifications
- Terms and conditions (payment, delivery, warranty)
- Bank details for payment processing
- Watermark image support (currently transparent placeholder)
- Background pattern integration

### Progressive Web App (PWA)

**Service Worker Strategy**
- Cache-first strategy for offline functionality
- Pre-caches critical resources (HTML, JSON data files, manifest)
- Network fallback for uncached resources
- Versioned cache management with cleanup on activation

**Manifest Configuration**
- Standalone display mode for app-like experience
- Custom theme color (#81D7D3) and background
- Icon assets at 192x192 and 512x512 resolutions
- Descriptive metadata for installation prompts

## External Dependencies

### Cloud Services

**Firebase (v12.6.0)**
- Firestore: NoSQL cloud database for quotation storage and synchronization
- Analytics: User behavior tracking (conditionally initialized client-side)
- Configuration via environment variables with fallback defaults
- Services: `firebaseService.ts` wraps CRUD operations with error handling

### Third-Party Libraries

**PDF Generation**
- jsPDF (v2.5.1): Core PDF document creation
- jspdf-autotable (v3.8.2): Table generation within PDFs

**Build & Development**
- Vite (v5.0.12): Build tool with ESM support and fast dev server
- @vitejs/plugin-react (v4.2.1): React Fast Refresh and JSX transformation
- TypeScript (v5.3.3): Static type checking

**CDN Dependencies (via importmap)**
- React and ReactDOM served from aistudiocdn.com for AI Studio compatibility
- Version-specific imports for consistency

### Configuration Files

**Environment Variables** (vite-env.d.ts)
- Firebase configuration keys (API key, project ID, etc.)
- Loaded via import.meta.env with VITE_ prefix
- Fallback values embedded in firebase.ts config

**Static Data Files**
- `clients.json`: Seed data for client information
- `products.json`: Seed data for product catalog
- Loaded on first run if localStorage is empty to avoid overwriting user data

### Development Tools

- TypeScript with strict mode for compile-time safety
- ESLint configurations (noUnusedLocals, noUnusedParameters)
- Hot module replacement for rapid development iteration
- Local server on port 5000 with network access (0.0.0.0)