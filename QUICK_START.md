# 🚀 Quick Start Guide - UrbanEyes v5.0

## New Folder Structure

Your project has been reorganized into a professional structure:

```
urbaneyes_v5.0/
├── frontend/          # All React/TypeScript code
├── backend/           # All Python code
├── docs/              # Documentation
├── README.md          # Main documentation
└── MIGRATION_GUIDE.md # Detailed migration info
```

## Getting Started (First Time After Reorganization)

### Step 1: Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Step 2: Start Frontend Development Server

```bash
npm run dev
```

Frontend will run on: **http://localhost:3000**

### Step 3: Start Backend Server (in a new terminal)

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd src
python main.py
```

Backend will run on: **http://localhost:5000**

## What Changed?

### ✅ Completed Automatically

1. **Folder Structure** - All files organized into frontend/backend
2. **Import Paths** - 39 files updated to use `@/` alias
3. **Configuration** - vite.config.ts, tsconfig.json updated
4. **Entry Point** - index.tsx renamed to main.tsx
5. **Documentation** - Moved to docs/ folder
6. **Backend** - Organized into src/services, src/routes, tests/

### 📝 Key Changes to Know

- **Entry file renamed**: `index.tsx` → `main.tsx`
- **Import paths now use**: `@/components/`, `@/services/`, etc.
- **Frontend is in**: `frontend/` directory
- **Backend is in**: `backend/` directory
- **Commands must run from**: respective directories

## Common Commands

### Frontend

```bash
cd frontend

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend

```bash
cd backend

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
cd src
python main.py

# Run tests
cd ..
pytest tests/
```

## Files Created

- ✅ `README.md` - Complete project documentation
- ✅ `MIGRATION_GUIDE.md` - Detailed migration information
- ✅ `.gitignore` - Comprehensive ignore rules
- ✅ `update-imports.ps1` - Import path update script (already run)
- ✅ `QUICK_START.md` - This file

## Next Steps

1. **Test the application**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Review changes**: Check the MIGRATION_GUIDE.md

3. **Update .env files**: Make sure your API keys are in `frontend/.env.local`

4. **Commit changes**: 
   ```bash
   git add .
   git commit -m "Reorganize codebase into professional structure"
   ```

## Troubleshooting

### Frontend won't start?

1. Clear node_modules and reinstall:
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check that all dependencies are installed

### Import errors?

- Make sure you're using `@/` alias instead of relative paths
- Check that tsconfig.json has the correct path mappings

### Backend errors?

1. Make sure virtual environment is activated
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Check Python version: `python --version` (needs 3.8+)

## Support

- See `README.md` for full documentation
- See `MIGRATION_GUIDE.md` for detailed migration info
- Check `docs/` folder for feature-specific documentation

---

**You're all set! Happy coding! 🎉**
