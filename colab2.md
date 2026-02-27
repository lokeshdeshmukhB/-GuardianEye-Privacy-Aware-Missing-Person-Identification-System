!pip install torchreid
from google.colab import drive
drive.mount("/content/drive", force_remount=True)

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from PIL import Image
from tqdm import tqdm
from torchvision import transforms
import kagglehub

path = kagglehub.dataset_download("pengcw1/market-1501")
DATASET_DIR = os.path.join(path, "Market-1501-v15.09.15")

QUERY_DIR   = os.path.join(DATASET_DIR, "query")
GALLERY_DIR = os.path.join(DATASET_DIR, "bounding_box_test")

print("Query:", QUERY_DIR)
print("Gallery:", GALLERY_DIR)
import torchreid

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = torchreid.models.build_model(
    name="osnet_x1_0",
    num_classes=1000,   # dummy, not used
    pretrained=True
)

model.eval()
model = model.to(device)

for p in model.parameters():
    p.requires_grad = False

print("✅ Pretrained OSNet loaded (frozen)")
transform = transforms.Compose([
    transforms.Resize((256, 128)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


@torch.no_grad()
def extract_embedding(img_path):
    img = Image.open(img_path).convert("RGB")
    img = transform(img).unsqueeze(0).to(device)

    feat = model(img, return_features=True)
    feat = F.normalize(feat, dim=1)

    return feat.cpu().numpy()[0]
@torch.no_grad()
def extract_embedding(img_path):
    img = Image.open(img_path).convert("RGB")
    img = transform(img).unsqueeze(0).to(device)

    # Correct torchreid inference
    feat = model(img, mode="test")   # <-- FIX
    feat = F.normalize(feat, dim=1)

    return feat.cpu().numpy()[0]
def extract_dir_embeddings(img_dir):
    paths = []
    embeddings = []

    for fname in tqdm(sorted(os.listdir(img_dir))):
        if not fname.endswith(".jpg"):
            continue

        path = os.path.join(img_dir, fname)
        emb = extract_embedding(path)

        paths.append(fname)
        embeddings.append(emb)

    return np.vstack(embeddings), paths
@torch.no_grad()
def extract_embedding(img_path):
    img = Image.open(img_path).convert("RGB")
    img = transform(img).unsqueeze(0).to(device)

    # Correct torchreid inference: just pass the image
    feat = model(img)
    feat = F.normalize(feat, dim=1)

    return feat.cpu().numpy()[0]

def extract_dir_embeddings(img_dir):
    paths = []
    embeddings = []

    for fname in tqdm(sorted(os.listdir(img_dir))):
        if not fname.endswith(".jpg"):
            continue

        path = os.path.join(img_dir, fname)
        emb = extract_embedding(path)

        paths.append(fname)
        embeddings.append(emb)

    return np.vstack(embeddings), paths

os.makedirs("embeddings", exist_ok=True)

query_embs, query_paths = extract_dir_embeddings(QUERY_DIR)
gallery_embs, gallery_paths = extract_dir_embeddings(GALLERY_DIR)

np.save("embeddings/query_embeddings.npy", query_embs)
np.save("embeddings/gallery_embeddings.npy", gallery_embs)

np.save("embeddings/query_paths.npy", query_paths)
np.save("embeddings/gallery_paths.npy", gallery_paths)

print("✅ All embeddings saved")
print(query_embs.shape)
print(gallery_embs.shape)

import numpy as np
import os
from PIL import Image
import matplotlib.pyplot as plt
from sklearn.metrics.pairwise import cosine_similarity

query_embs = np.load("embeddings/query_embeddings.npy")
gallery_embs = np.load("embeddings/gallery_embeddings.npy")
query_paths = np.load("embeddings/query_paths.npy", allow_pickle=True)
gallery_paths = np.load("embeddings/gallery_paths.npy", allow_pickle=True)

def rank_gallery(query_idx, top_k=5):
    q = query_embs[query_idx].reshape(1, -1)
    sims = cosine_similarity(q, gallery_embs)[0]
    idxs = np.argsort(-sims)[:top_k]
    return [(gallery_paths[i], sims[i]) for i in idxs]
def visualize_reid(query_idx, top_k=5):
    results = rank_gallery(query_idx, top_k)

    plt.figure(figsize=(3*(top_k+1), 4))

    # Query image
    qimg = Image.open(os.path.join(QUERY_DIR, query_paths[query_idx])).convert("RGB")
    plt.subplot(1, top_k+1, 1)
    plt.imshow(qimg)
    plt.title("Query")
    plt.axis("off")

    # Gallery matches
    for i, (path, score) in enumerate(results):
        img = Image.open(os.path.join(GALLERY_DIR, path)).convert("RGB")
        plt.subplot(1, top_k+1, i+2)
        plt.imshow(img)
        plt.title(f"{score:.2f}")
        plt.axis("off")

    plt.tight_layout()
    plt.show()
