# 🔄 Codebase Reorganization - Migration Guide

**Date:** November 20, 2025  
**Version:** 5.0.0  
**Status:** ✅ Complete

## 📋 Summary

The UrbanEyes v5.0 codebase has been reorganized into a professional structure with clear separation between frontend and backend code.

## 🎯 Changes Made

### 1. New Directory Structure

#### **Frontend** (`frontend/`)
All React/TypeScript code has been moved to the `frontend/` directory:

```
frontend/
├── src/
│   ├── components/      # All React components (previously in /components)
│   ├── contexts/        # React contexts (previously in /contexts)
│   ├── hooks/          # Custom hooks (previously in /hooks)
│   ├── services/       # API services (previously in /services)
│   ├── utils/          # Utilities (previously in /utils)
│   ├── types/          # TypeScript types (previously in /types)
│   ├── data/           # Static data (previously in /data)
│   ├── shaders/        # WebGL shaders (previously in /shaders)
│   ├── App.tsx         # Main app (previously /App.tsx)
│   ├── main.tsx        # Entry point (previously /index.tsx) ⚠️ RENAMED
│   └── global.d.ts     # Global types (previously /global.d.ts)
├── public/             # Static assets (previously /public)
├── index.html          # HTML template (previously /index.html)
├── package.json        # Frontend deps (previously /package.json)
├── tsconfig.json       # TS config (previously /tsconfig.json)
└── vite.config.ts      # Vite config (previously /vite.config.ts)
```

#### **Backend** (`backend/`)
Python backend has been reorganized:

```
backend/
├── src/
│   ├── services/       # Business logic
│   │   ├── __init__.py
│   │   └── weather_service.py (moved from /backend/weather_service.py)
│   ├── routes/         # API endpoints (new)
│   │   └── __init__.py
│   ├── utils/          # Helper functions (new)
│   │   └── __init__.py
│   ├── __init__.py
│   └── main.py         # Main server (moved from /backend/main.py)
├── tests/              # Test files
│   ├── __init__.py
│   └── test_global_accuracy.py (moved from /backend/test_global_accuracy.py)
├── requirements.txt    # Python deps
└── README.md           # Backend docs
```

#### **Documentation** (`docs/`)
All markdown documentation has been moved:

```
docs/
├── 3D_ANALYSIS_SYSTEM.md
├── 3D_ENVIRONMENTAL_ANALYSIS_GUIDE.md
├── 3D_INTEGRATION_GUIDE.md
├── CHATBOT_DESIGN.md
├── ENVIRONMENTAL_ANALYSIS_DOCS.md
├── EXPORT_LAYER_ORGANIZATION.md
├── FREE_GRADIENT_USAGE.md
├── GLOBAL_ACCURACY_UPGRADE.md
├── MAP_EXPORT_FORMATS.md
├── PHASE2_SUMMARY.md
└── THERMAL_COMFORT_SETUP.md
```

### 2. Configuration Updates

#### **vite.config.ts**
- Changed env loading path: `loadEnv(mode, '../', '')`
- Updated alias: `'@': path.resolve(__dirname, 'src')`
- Added build output directory: `outDir: 'dist'`

#### **tsconfig.json**
- Updated paths: `"@/*": ["./src/*"]`
- Updated include: `"src/**/*"`

#### **index.html**
- Updated script path: `/src/main.tsx` (was `/index.tsx`)

#### **.gitignore**
- Comprehensive frontend/backend sections
- Python virtual environment ignores
- Build output directories
- OS-specific files

### 3. File Renames

| Old Path | New Path |
|----------|----------|
| `/index.tsx` | `/frontend/src/main.tsx` |
| All component imports | Now use `@/` alias |

## ⚠️ Breaking Changes

### Import Paths
All import paths need to be updated to use the new `@/` alias:

**Before:**
```typescript
import Component from '../components/Component';
import { service } from '../services/service';
```

**After:**
```typescript
import Component from '@/components/Component';
import { service } from '@/services/service';
```

### Entry Point
The main entry point has been renamed:
- **Old:** `index.tsx`
- **New:** `main.tsx`

This is reflected in `index.html`.

### Working Directory
Commands must now be run from the appropriate directory:

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd src
python main.py
```

## 🔧 Action Items

### For Developers

1. **Update imports** in all TypeScript/TSX files:
   - Use `@/components/` instead of relative paths
   - Use `@/services/`, `@/utils/`, `@/contexts/`, etc.

2. **Reinstall dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Update backend Python imports** if needed:
   ```python
   from src.services.weather_service import WeatherService
   ```

4. **Test the application:**
   - Frontend: `cd frontend && npm run dev`
   - Backend: `cd backend/src && python main.py`

5. **Update any deployment scripts** to reflect new structure

### CI/CD Updates Needed

Update build/deployment scripts:

**Frontend:**
```bash
cd frontend
npm install
npm run build
# Output: frontend/dist/
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Start from backend/src/main.py
```

## ✅ Benefits

1. **Clear Separation**: Frontend and backend are completely separate
2. **Professional Structure**: Follows industry best practices
3. **Scalability**: Easy to add new features in organized folders
4. **Better IDE Support**: Path aliases work better
5. **Team Collaboration**: Easier for team members to understand structure
6. **Deployment**: Simpler to deploy frontend and backend separately

## 📚 Resources

- **README.md** - Complete project documentation
- **docs/** - All technical documentation
- **frontend/package.json** - Frontend dependencies
- **backend/requirements.txt** - Backend dependencies

## 🐛 Known Issues

None at this time. If you encounter issues:
1. Clear `node_modules` and reinstall: `cd frontend && rm -rf node_modules && npm install`
2. Clear Python cache: `cd backend && find . -type d -name __pycache__ -exec rm -rf {} +`
3. Check import paths are using `@/` alias correctly

## 📞 Support

If you need help with the migration:
1. Check the main README.md
2. Review this migration guide
3. Check the docs/ folder for specific feature documentation

---

**Migration completed successfully! 🎉**
