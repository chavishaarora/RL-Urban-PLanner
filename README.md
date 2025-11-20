# UrbanEyes v5.0

A comprehensive urban planning and analysis platform with AI-powered insights, environmental analysis, and 3D visualization capabilities.

## 📁 Project Structure

```
urbaneyes_v5.0/
├── frontend/               # React + TypeScript frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts (Auth, Theme, etc.)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services and business logic
│   │   ├── utils/         # Utility functions
│   │   ├── types/         # TypeScript type definitions
│   │   ├── data/          # Static data and templates
│   │   ├── shaders/       # WebGL/Three.js shaders
│   │   ├── App.tsx        # Main application component
│   │   ├── main.tsx       # Application entry point
│   │   └── global.d.ts    # Global type declarations
│   ├── public/            # Static assets
│   ├── index.html         # HTML template
│   ├── package.json       # Frontend dependencies
│   ├── tsconfig.json      # TypeScript configuration
│   └── vite.config.ts     # Vite bundler configuration
│
├── backend/               # Python backend server
│   ├── src/
│   │   ├── services/      # Backend services
│   │   ├── routes/        # API routes
│   │   ├── utils/         # Helper utilities
│   │   └── main.py        # Main backend server
│   ├── tests/             # Backend tests
│   ├── requirements.txt   # Python dependencies
│   └── README.md          # Backend documentation
│
├── docs/                  # Project documentation
│   ├── 3D_ANALYSIS_SYSTEM.md
│   ├── ENVIRONMENTAL_ANALYSIS_DOCS.md
│   ├── THERMAL_COMFORT_SETUP.md
│   └── ...
│
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **Google Maps API Key**
- **Gemini API Key** (for AI features)

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

5. Build for production:
   ```bash
   npm run build
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the backend server:
   ```bash
   cd src
   python main.py
   ```

   The backend will be available at `http://localhost:5000`

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Three.js** - 3D graphics
- **Framer Motion** - Animations
- **Tailwind CSS** - Styling
- **Google Maps API** - Maps and location services
- **Supabase** - Authentication and database

### Backend
- **Python** - Backend language
- **Flask** (likely) - Web framework
- **FastAPI** (alternative) - Modern API framework

## 📋 Key Features

- 🗺️ **Interactive Maps** - Google Maps integration with custom overlays
- 🏗️ **3D Visualization** - Three.js-powered 3D analysis
- 🌤️ **Environmental Analysis** - Weather, solar, wind, and thermal analysis
- 🤖 **AI Chatbot** - Gemini-powered planning assistant
- 📊 **Data Analysis** - Population density, land use, accessibility
- 📈 **Market Analysis** - Real estate and market insights
- 🏘️ **Urban Planning** - Massing strategy and conceptual planning
- 📤 **Export Tools** - PDF, Excel, and image exports

## 📖 Documentation

Detailed documentation is available in the `docs/` directory:

- **3D Analysis System** - 3D visualization and analysis features
- **Environmental Analysis** - Environmental metrics and calculations
- **Thermal Comfort Setup** - Thermal comfort analysis configuration
- **Map Export Formats** - Export capabilities and formats
- **Chatbot Design** - AI chatbot architecture and features

## 🔧 Configuration

### Frontend Configuration

- **Vite Config** (`frontend/vite.config.ts`) - Build and dev server settings
- **TypeScript Config** (`frontend/tsconfig.json`) - TypeScript compiler options
- **Path Aliases** - `@/` points to `frontend/src/`

### Environment Variables

Create `.env.local` files in the root and frontend directories:

```env
# API Keys
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Supabase (if using)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
npm test
```

### Backend Tests
```bash
cd backend
pytest tests/
```

## 📦 Building for Production

### Frontend
```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`

### Backend
Package the backend using your preferred method (Docker, systemd, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary. All rights reserved.

## 👥 Authors

- Your Name/Team

## 🙏 Acknowledgments

- Google Maps Platform
- Google Gemini AI
- React and TypeScript communities
- Three.js community
- Open-source contributors

---

**Version:** 5.0.0  
**Last Updated:** November 2025
