# 📂 UrbanEyes v5.0 - Complete Project Structure

## Root Directory Overview

```
urbaneyes_v5.0/
│
├── 📁 frontend/                    # Frontend Application
│   ├── 📁 src/                     # Source code
│   │   ├── 📁 components/          # React components (151+ files)
│   │   │   ├── 📁 planner/         # Conceptual planner components
│   │   │   ├── AccessibilityMap.tsx
│   │   │   ├── AnalysisView.tsx
│   │   │   ├── Chatbot.tsx
│   │   │   ├── ConceptualPlanner.tsx
│   │   │   ├── DesignEditor.tsx
│   │   │   ├── Environmental3DAnalysis.tsx
│   │   │   ├── EnvironmentalAnalysis.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── ProjectDashboard.tsx
│   │   │   ├── SiteSelector.tsx
│   │   │   └── ... (many more)
│   │   │
│   │   ├── 📁 contexts/            # React contexts
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   │
│   │   ├── 📁 hooks/               # Custom React hooks
│   │   │   ├── useLocalStorage.ts
│   │   │   └── useMapColorConfig.ts
│   │   │
│   │   ├── 📁 services/            # Business logic & API services
│   │   │   ├── 📁 analysis/        # Analysis services
│   │   │   ├── 📁 chatbot/         # Chatbot services
│   │   │   ├── amenityCoverage.ts
│   │   │   ├── geminiService.ts
│   │   │   ├── googlePlacesService.ts
│   │   │   ├── layoutService.ts
│   │   │   ├── mapExportService.ts
│   │   │   ├── osmService.ts
│   │   │   ├── shadowAnalysis3D.ts
│   │   │   ├── solarAnalysis3D.ts
│   │   │   ├── supabaseClient.ts
│   │   │   ├── weatherService.ts
│   │   │   ├── windAnalysis3D.ts
│   │   │   └── ... (30+ services)
│   │   │
│   │   ├── 📁 utils/               # Utility functions
│   │   │   ├── colorUtils.ts
│   │   │   ├── mapBackground.ts
│   │   │   └── ...
│   │   │
│   │   ├── 📁 types/               # TypeScript type definitions
│   │   │   ├── three-fiber.d.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── 📁 data/                # Static data
│   │   │   ├── designTemplates.ts
│   │   │   └── templateImages.ts
│   │   │
│   │   ├── 📁 shaders/             # WebGL/Three.js shaders
│   │   │
│   │   ├── App.tsx                 # Main application component
│   │   ├── main.tsx                # Entry point (was index.tsx)
│   │   └── global.d.ts             # Global TypeScript declarations
│   │
│   ├── 📁 public/                  # Static assets
│   │   ├── favicon.svg
│   │   ├── favicon.ico
│   │   ├── favicon-96x96.png
│   │   ├── site.webmanifest
│   │   └── metadata.json
│   │
│   ├── index.html                  # HTML template
│   ├── package.json                # Frontend dependencies
│   ├── package-lock.json           # Dependency lock file
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vite.config.ts              # Vite bundler config
│   ├── .env                        # Environment variables
│   └── .env.local                  # Local environment variables
│
├── 📁 backend/                     # Backend Application
│   ├── 📁 src/                     # Source code
│   │   ├── 📁 services/            # Backend services
│   │   │   ├── __init__.py
│   │   │   └── weather_service.py
│   │   │
│   │   ├── 📁 routes/              # API routes
│   │   │   └── __init__.py
│   │   │
│   │   ├── 📁 utils/               # Helper utilities
│   │   │   └── __init__.py
│   │   │
│   │   ├── __init__.py
│   │   └── main.py                 # Main server file
│   │
│   ├── 📁 tests/                   # Test files
│   │   ├── __init__.py
│   │   └── test_global_accuracy.py
│   │
│   ├── requirements.txt            # Python dependencies
│   └── README.md                   # Backend documentation
│
├── 📁 docs/                        # Documentation
│   ├── 3D_ANALYSIS_SYSTEM.md
│   ├── 3D_ENVIRONMENTAL_ANALYSIS_GUIDE.md
│   ├── 3D_INTEGRATION_GUIDE.md
│   ├── CHATBOT_DESIGN.md
│   ├── ENVIRONMENTAL_ANALYSIS_DOCS.md
│   ├── EXPORT_LAYER_ORGANIZATION.md
│   ├── FREE_GRADIENT_USAGE.md
│   ├── GLOBAL_ACCURACY_UPGRADE.md
│   ├── MAP_EXPORT_FORMATS.md
│   ├── PHASE2_SUMMARY.md
│   └── THERMAL_COMFORT_SETUP.md
│
├── 📁 .git/                        # Git repository
├── 📁 .claude/                     # Claude AI context
├── 📁 node_modules/                # Old dependencies (can be removed)
├── 📁 dist/                        # Old build output (can be removed)
│
├── .gitignore                      # Git ignore rules
├── .env                            # Root environment variables
├── .env.local                      # Root local env variables
├── README.md                       # Main project documentation
├── MIGRATION_GUIDE.md              # Detailed migration information
├── QUICK_START.md                  # Quick start guide
├── update-imports.ps1              # Import path update script
└── untitled.tsx                    # Temporary file (can be removed)
```

## Statistics

### Frontend
- **Total Components**: 150+ React components
- **Services**: 30+ service modules
- **Contexts**: 2 React contexts
- **Hooks**: 2+ custom hooks
- **Updated Files**: 39 files with import path updates

### Backend
- **Services**: Weather service (more to be organized)
- **Tests**: 1 test file (more to be added)
- **Structure**: Ready for routes, services, utils expansion

### Documentation
- **Markdown Files**: 11 documentation files
- **Guides**: README, Migration Guide, Quick Start

## Import Path Updates

All imports now use the `@/` alias:

**Before:**
```typescript
import Component from '../../../components/Component';
import { service } from '../../services/service';
```

**After:**
```typescript
import Component from '@/components/Component';
import { service } from '@/services/service';
```

## Key Technologies

### Frontend
- React 18.2.0
- TypeScript 5.8.2
- Vite 6.2.0
- Three.js 0.181.0
- Framer Motion 12.23.24
- Google Maps API
- Gemini AI
- Supabase

### Backend
- Python 3.8+
- Flask/FastAPI (to be confirmed)

## Development Workflow

1. **Frontend Development**:
   ```bash
   cd frontend
   npm run dev
   ```
   → Runs on http://localhost:3000

2. **Backend Development**:
   ```bash
   cd backend
   venv\Scripts\activate
   cd src
   python main.py
   ```
   → Runs on http://localhost:5000

## Next Phase Recommendations

1. **Backend Organization**:
   - Add API routes to `backend/src/routes/`
   - Move business logic to `backend/src/services/`
   - Add utilities to `backend/src/utils/`
   - Expand test coverage in `backend/tests/`

2. **Frontend Optimization**:
   - Consider lazy loading for components
   - Implement code splitting
   - Add component documentation

3. **Testing**:
   - Add frontend unit tests
   - Add integration tests
   - Add E2E tests

4. **Deployment**:
   - Containerize with Docker
   - Set up CI/CD pipeline
   - Configure environment-specific builds

---

**Structure optimized for scalability, maintainability, and team collaboration! 🚀**
