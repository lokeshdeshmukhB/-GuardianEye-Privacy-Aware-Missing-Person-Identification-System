# 🛡️ GuardianEye — Privacy-Aware Person Re-Identification System

> A full-stack Multi-Model AI system combining **Person Re-ID**, **Pedestrian Attribute Recognition**, and **Gait-based Identity Matching** into a unified MERN web application with FastAPI ML microservices.

---

## 🏗️ Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│   React      │────▶│  Express.js  │────▶│   FastAPI    │     │ MongoDB  │
│   Frontend   │     │   Backend    │────▶│  ML Service  │     │          │
│  (Vite)      │     │  (Node.js)   │     │  (PyTorch)   │     │          │
│  Port: 5173  │     │  Port: 5001  │     │  Port: 8001  │     │Port:27017│
└─────────────┘     └──────┬───────┘     └──────────────┘     └──────────┘
                           │                                        ▲
                           └────────────────────────────────────────┘
```

## 🧠 ML Models

### Model 1: Person Re-Identification (OSNet)
- **Architecture**: OSNet x1.0 pretrained on ImageNet
- **Dataset**: Market-1501
- **Input**: RGB person crop, resized to `256 × 128`
- **Output**: 512-dim L2-normalized feature embedding
- **Matching**: Cosine similarity against gallery embeddings

### Model 2: Pedestrian Attribute Recognition (PA-100K)
- **Architecture**: ResNet-50 with FC → 26 attributes
- **Dataset**: PA-100K (100,000 pedestrian images)
- **Input**: RGB person image, resized to `224 × 112`
- **Output**: 26 binary attribute predictions with confidence scores
- **Attributes**: Gender, Age, Clothing, Accessories, Orientation

### Model 3: Gait Recognition (SimpleGaitSet)
- **Architecture**: Custom CNN with temporal max-pooling
- **Dataset**: CASIA-B
- **Input**: 30 grayscale silhouette frames, `64 × 44`
- **Output**: L2-normalized gait embedding
- **Matching**: Cosine similarity for identity matching

---

## 💻 Frontend Features

| Page | Description |
|------|-------------|
| **Dashboard** | Overview stats, charts, Re-ID quick access panel |
| **Re-ID Hub** | ML service status, model health, quick actions |
| **Person Re-ID Search** | Upload query image, Top-K gallery matching |
| **Attribute Recognition** | 26-attribute binary classification with grouped display |
| **Gait Recognition** | Silhouette sequence upload, identity matching & enrollment |
| **Gallery Management** | Add/remove persons, manage Re-ID embeddings |
| **AI Search** | Missing person search with facial recognition |
| **Report Case** | File missing person reports |
| **Admin Panel** | User management (admin only) |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Python** 3.9+
- **MongoDB** 7.0+ (local or Atlas)
- **CUDA** (optional, for GPU acceleration)

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/guardian-eye.git
cd guardian-eye
```

### 2. ML Service Setup
```bash
cd ml-services

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Place model checkpoints
# - ml-services/checkpoints/pa100k_best.pth
# - ml-services/checkpoints/gait_best.pth
# - OSNet downloads automatically via torchreid

# Create embeddings directory
mkdir -p embeddings

# Start the ML service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file
echo "MONGO_URI=mongodb://localhost:27017/person_reid
FASTAPI_BASE_URL=http://localhost:8001
PORT=5001
JWT_SECRET=your-secret-key
UPLOAD_DIR=./uploads" > .env

# Start the backend
node server.js
```

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Open in Browser
Navigate to `http://localhost:5173`

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# Frontend:    http://localhost:5173
# Backend:     http://localhost:5001
# ML Service:  http://localhost:8001
# MongoDB:     localhost:27017
```

---

## 📡 API Endpoints

### Express Backend (Port 5001)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/reid/search` | Proxy to FastAPI Re-ID search |
| POST | `/api/reid/gallery` | Add person to gallery |
| GET | `/api/reid/gallery` | Get all gallery persons |
| DELETE | `/api/reid/gallery/:id` | Remove person from gallery |
| POST | `/api/attributes/predict` | Proxy to PA-100K prediction |
| POST | `/api/gait/match` | Proxy to gait matching |
| POST | `/api/gait/add` | Enroll gait signature |
| GET | `/api/stats` | Dashboard statistics |

### FastAPI ML Service (Port 8001)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/reid/search` | Extract embedding & match gallery |
| POST | `/reid/add-to-gallery` | Add image embedding to gallery |
| POST | `/attributes/predict` | Predict 26 pedestrian attributes |
| POST | `/gait/match` | Match gait sequence to gallery |
| POST | `/gait/add` | Enroll gait embedding |
| GET | `/` | Service health & model status |

---

## 🗂️ Project Structure

```
guardian-eye/
├── backend/                    # Node.js Express Backend
│   ├── models/                 # Mongoose schemas
│   ├── routes/                 # API route handlers
│   ├── middleware/              # Auth, upload, error handling
│   ├── services/               # External service integrations
│   └── server.js               # Entry point
│
├── ml-services/                # FastAPI ML Microservice
│   ├── models/                 # Model loaders (OSNet, PA100K, GaitSet)
│   ├── routers/                # API routers (reid, attributes, gait)
│   ├── utils/                  # Image processing, embedding store
│   ├── checkpoints/            # Trained model weights (.pth)
│   ├── embeddings/             # Precomputed .npy embeddings
│   └── main.py                 # FastAPI entry point
│
├── frontend/                   # React (Vite) Frontend
│   └── src/
│       ├── components/         # Layout, shared components
│       ├── pages/              # All page components
│       ├── services/           # Axios API clients
│       ├── store/              # Zustand global state
│       ├── context/            # Auth context
│       ├── index.css           # Global design system
│       └── App.jsx             # Router configuration
│
├── docker-compose.yml          # Multi-service orchestration
└── README.md                   # This file
```

---

## ⚙️ Environment Variables

### Backend `.env`
```env
MONGO_URI=mongodb://localhost:27017/person_reid
FASTAPI_BASE_URL=http://localhost:8001
PORT=5001
JWT_SECRET=your-secret-key-here
UPLOAD_DIR=./uploads
```

### ML Service `.env`
```env
CHECKPOINT_DIR=./checkpoints
EMBEDDINGS_DIR=./embeddings
PA100K_CHECKPOINT=./checkpoints/pa100k_best.pth
GAIT_CHECKPOINT=./checkpoints/gait_best.pth
TOP_K=5
```

---

## 🔧 Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Zustand, React Router, Recharts |
| Backend | Node.js, Express, Mongoose, Multer, Axios |
| ML Service | FastAPI, PyTorch, torchreid, NumPy, scikit-learn |
| Database | MongoDB 7 |
| Styling | Vanilla CSS (Custom Design System) |
| Deployment | Docker, Docker Compose |

---

## 📝 Important Notes

1. **OSNet inference**: Use `model(img)` directly — NOT `model(img, return_features=True)`
2. **PA-100K output**: Apply `torch.sigmoid()` before thresholding at 0.5 (NOT softmax)
3. **Gait input shape**: Must be `(batch=1, time=30, channels=1, height=64, width=44)`
4. **Model loading**: All three models load at FastAPI startup and stay in memory
5. **Embedding sync**: When adding to gallery, both `.npy` files and MongoDB are updated
6. **Gait frames**: If < 30 frames provided, they are tiled/repeated to reach 30

---

## 📄 License

This project is for educational and research purposes.

---

Built with ❤️ using MERN Stack + PyTorch + FastAPI
