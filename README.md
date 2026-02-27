# 🛡️ GuardianEye — Privacy-Aware Missing Person Identification System

> A full-stack MERN + Python Flask application that uses three AI models to identify missing persons through multi-modal fusion: **attribute recognition**, **person re-identification**, and **gait analysis**.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [AI Pipeline](#-ai-pipeline)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Features](#-features)
- [Privacy & Compliance](#-privacy--compliance)
- [Training Notebooks](#-training-notebooks)

---

## 🔍 Overview

GuardianEye is a B.Tech final-year project that enables law enforcement officers to:

1. **Report** missing persons with photos and last-seen details
2. **Search** the database using an uploaded probe image (AI-powered)
3. **Match** candidates using three independent AI signals fused together
4. **Audit** all access through built-in privacy compliance logging

The system is designed for real-world deployment with role-based access (Officer / Admin), JWT authentication, and full audit trails.

---

## 🤖 AI Pipeline

```
Probe Image
    │
    ├──▶ PA-100K ResNet50 ──▶ 28 Attribute Scores ──────────────┐
    │    (colab.md / colab3.md / colab4.md)                      │
    │                                                             ├──▶ Fusion Score
    ├──▶ OSNet Re-ID ──────▶ 512-dim Embedding ─────────────────┤     (weighted avg)
    │    (colab2.md)          Cosine Similarity                   │
    │                                                             │
    └──▶ Gait Analysis ────▶ 128-dim Signature ─────────────────┘
         (Silhouette-based)
```

### Model Details

| Model | Dataset | Architecture | Task | Output |
|-------|---------|-------------|------|--------|
| **PA-100K Attribute** | PA-100K (100,000 images) | ResNet50 + FC head | Pedestrian attribute recognition | 28 binary attributes |
| **OSNet Re-ID** | Market-1501 (32,668 images) | OSNet x1.0 (pretrained) | Person re-identification | 512-dim embedding |
| **Gait Model** | Silhouette sequences | Custom CNN | Gait signature extraction | 128-dim signature |

### Fusion Weights (Multi-Modal Mode)
- Re-ID score: **50%**
- Attribute score: **30%**
- Gait score: **20%**

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite, React Router v6, Recharts, React Icons |
| **Backend** | Node.js, Express.js, Mongoose (MongoDB) |
| **ML Service** | Python 3.12, Flask 3, PyTorch, torchvision, scikit-learn |
| **Database** | MongoDB |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **File Upload** | Multer |
| **Styling** | Vanilla CSS with CSS Variables (dark theme) |

---

## 📁 Project Structure

```
btech_prj/
│
├── backend/                      # Express.js REST API
│   ├── models/
│   │   ├── User.js               # Officer/Admin accounts
│   │   ├── MissingPerson.js      # Case data + AI embeddings
│   │   └── SearchLog.js          # Privacy audit log
│   ├── routes/
│   │   ├── authRoutes.js         # POST /api/auth/login|register
│   │   ├── caseRoutes.js         # CRUD for missing person cases
│   │   ├── searchRoutes.js       # AI-powered search endpoint
│   │   └── adminRoutes.js        # User management + stats
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT protect + adminOnly guards
│   │   └── uploadMiddleware.js   # Multer (images/video, 50MB limit)
│   ├── uploads/                  # Uploaded case photos (gitignored)
│   ├── .env                      # Environment variables
│   ├── server.js                 # Entry point
│   └── package.json
│
├── frontend/                     # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx        # Sidebar + topbar shell
│   │   │   └── Layout.css
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Auth state (login/logout/user)
│   │   ├── services/
│   │   │   └── api.js            # Axios instance + all API calls
│   │   ├── pages/
│   │   │   ├── Landing.jsx       # Public landing page
│   │   │   ├── Login.jsx         # Officer sign-in
│   │   │   ├── Register.jsx      # Officer registration
│   │   │   ├── Dashboard.jsx     # Stats + charts + recent cases
│   │   │   ├── SearchPage.jsx    # AI probe-image search
│   │   │   ├── ReportCase.jsx    # Report missing person form
│   │   │   ├── CaseDetail.jsx    # Case view + AI attribute bars
│   │   │   ├── AdminPanel.jsx    # User management + audit logs
│   │   │   └── PrivacyPage.jsx   # Compliance documentation
│   │   ├── App.jsx               # Router + protected routes
│   │   ├── main.jsx              # React entry point
│   │   └── index.css             # Global design system (CSS vars)
│   ├── index.html
│   ├── vite.config.js            # Vite + proxy to backend
│   └── package.json
│
├── ml-service/                   # Python Flask AI service
│   ├── app.py                    # Flask server (port 8000)
│   ├── requirements.txt
│   ├── pa100k_last.pth           # ← Place trained model here
│   └── gait_best.pth             # ← Place trained model here
│
├── colab.md                      # Training notebook 1 (PA-100K inference)
├── colab2.md                     # Training notebook 2 (OSNet Re-ID)
├── colab3.md                     # Training notebook 3 (PA-100K ResNet50)
├── colab4.md                     # Training notebook 4 (PA-100K full pipeline)
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ and npm
- **MongoDB** (local or Atlas)
- **Python** 3.10+

### 1. Clone and Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# ML Service
cd ../ml-service
python -m pip install flask flask-cors numpy scikit-learn Pillow
```

### 2. Configure Environment

Create `backend/.env` (already included):

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/missing_person_db
JWT_SECRET=your_secret_key_here
ML_SERVICE_URL=http://127.0.0.1:8000
NODE_ENV=development
```

### 3. Start MongoDB

```bash
# Windows (as Administrator)
net start MongoDB

# Or manually
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
```

### 4. Start All Services

Open **3 terminals**:

```bash
# Terminal 1 — Backend API (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev

# Terminal 3 — ML Service (port 8000)
cd ml-service
python app.py
```

Open **http://localhost:5173** → Register as an officer → Start using the system.

> **Note:** The ML service runs in **mock mode** if PyTorch is not installed. All endpoints still work with realistic synthetic data.

### 5. Install PyTorch (Optional — for real AI predictions)

```bash
# CPU version (~250MB)
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# GPU version (CUDA 12.1)
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

After installing, place your trained model files in `ml-service/`:
- `pa100k_last.pth` — PA-100K attribute model checkpoint
- `gait_best.pth` — Gait model checkpoint

---

## 🔐 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/missing_person_db` | MongoDB connection string |
| `JWT_SECRET` | — | Secret key for JWT signing (change in production!) |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | URL of the Python Flask ML service |
| `NODE_ENV` | `development` | Environment mode |

---

## 📡 API Reference

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register a new officer | None |
| `POST` | `/api/auth/login` | Login, returns JWT token | None |
| `GET` | `/api/auth/me` | Get current user profile | JWT |

### Cases

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/cases` | List cases (paginated, filter by status) | JWT |
| `POST` | `/api/cases` | Create new case (with photo upload) | JWT |
| `GET` | `/api/cases/:id` | Get case details + access log | JWT |
| `PATCH` | `/api/cases/:id/status` | Update case status | JWT |
| `DELETE` | `/api/cases/:id` | Delete a case | JWT |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/search` | AI-powered multi-modal search | JWT |
| `GET` | `/api/search/logs` | Retrieve search audit logs | JWT |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/admin/stats` | System statistics | JWT |
| `GET` | `/api/admin/users` | List all officers | JWT + Admin |
| `DELETE` | `/api/admin/users/:id` | Delete an officer | JWT + Admin |

### ML Service (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check + model status |
| `POST` | `/api/attributes` | Extract PA-100K attributes from image |
| `POST` | `/api/reid` | Extract 512-dim Re-ID embedding |
| `POST` | `/api/gait` | Extract gait signature (mock) |
| `POST` | `/api/match` | Multi-modal matching against gallery |

---

## ✨ Features

### For Officers
- **Report Case** — Upload up to 5 photos + personal details. AI auto-extracts attributes.
- **AI Search** — Upload a probe image and choose search mode (multi-modal / Re-ID only / attribute / gait). Get ranked candidates with confidence scores.
- **Case Detail** — View 28-attribute breakdown (bars), 512-dim Re-ID embedding heatmap, gait score, and full access log.
- **Dashboard** — Weekly case activity chart, status pie chart, recent cases table.

### For Admins
- **User Management** — View all officers, delete accounts.
- **Audit Logs** — Full search history with officer identity, search type, result count, and processing time.
- **System Stats** — Total cases, active/found counts, search frequency.

---

## 🔒 Privacy & Compliance

- **JWT Authentication** on all API endpoints (7-day expiry)
- **Role-Based Access**: Officer (cases + search), Admin (+ user management)
- **Access Logging**: Every case view is recorded with officer name + timestamp
- **Bcrypt** password hashing (12 salt rounds)
- **Biometric data** (Re-ID embeddings, gait signatures) treated as sensitive — stored encrypted in MongoDB
- Designed for GDPR / India PDPB compliance

---

## 📓 Training Notebooks

The AI models were trained in Google Colab:

| Notebook | File | Description |
|----------|------|-------------|
| Colab 1 | `colab.md` | PA-100K dataset loading + inference pipeline |
| Colab 2 | `colab2.md` | OSNet Re-ID with Market-1501 dataset |
| Colab 3 | `colab3.md` | PA-100K ResNet50 training (with checkpointing) |
| Colab 4 | `colab4.md` | PA-100K full pipeline + evaluation |

To retrain, open the notebooks in Google Colab, mount your Drive, and run. Checkpoints are saved to `/content/drive/MyDrive/model2/checkpoints/`.

---

## 👨‍💻 Development

```bash
# Run backend tests
cd backend && npm test

# Lint frontend
cd frontend && npm run lint

# Build frontend for production
cd frontend && npm run build

# Check ML service health
curl http://localhost:8000/
```

---

## 📄 License

This project is developed as a B.Tech final-year project. For academic use only.

---

<div align="center">
  <strong>Built with MERN Stack + PyTorch | GuardianEye © 2025</strong>
</div>
