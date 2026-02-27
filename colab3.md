from google.colab import drive
drive.mount('/content/drive', force_remount=True)

import os
import pandas as pd
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
import torchvision.models as models
from tqdm import tqdm
import kagglehub

path = kagglehub.dataset_download(
    "yuulind/pa-100k"
)
print(path)
# KaggleHub download path (already created by kagglehub)
# Example: /root/.cache/kagglehub/datasets/yuulind/pa-100k/versions/1
IMG_DIR = os.path.join(path, "PA-100K", "data")

BASE_DIR = "/content/drive/MyDrive/model2/data/pa100k/PA-100K"

TRAIN_CSV = f"{BASE_DIR}/train.csv"
VAL_CSV   = f"{BASE_DIR}/val.csv"
TEST_CSV  = f"{BASE_DIR}/test.csv"

CHECKPOINT_DIR = "/content/drive/MyDrive/model2/checkpoints"
OUTPUT_DIR = "/content/drive/MyDrive/model2/output"

os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(TRAIN_CSV)

print("Total rows:", len(df))
print("Total columns:", df.shape[1])
print("Columns:", df.columns.tolist())

ATTRIBUTE_NAMES = df.columns[1:].tolist()
NUM_ATTRIBUTES = len(ATTRIBUTE_NAMES)

print("Number of attributes:", NUM_ATTRIBUTES)
print("Attributes:", ATTRIBUTE_NAMES)

class PA100KDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None):
        self.df = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        img_name = self.df.iloc[idx, 0]
        img_path = os.path.join(self.img_dir, img_name)

        image = Image.open(img_path).convert("RGB")

        label = self.df.iloc[idx, 1:].astype(float).values
        label = torch.tensor(label, dtype=torch.float32)

        if self.transform:
            image = self.transform(image)

        return image, label

transform = transforms.Compose([
    transforms.Resize((224, 112)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

train_dataset = PA100KDataset(TRAIN_CSV, IMG_DIR, transform)
val_dataset   = PA100KDataset(VAL_CSV, IMG_DIR, transform)
test_dataset  = PA100KDataset(TEST_CSV, IMG_DIR, transform)

train_loader = DataLoader(
    train_dataset,
    batch_size=64,
    shuffle=True,
    num_workers=2,
    pin_memory=True
)

val_loader = DataLoader(
    val_dataset,
    batch_size=64,
    shuffle=False,
    num_workers=2,
    pin_memory=True
)

# Sanity check
imgs, labels = next(iter(train_loader))
print("Images:", imgs.shape)
print("Labels:", labels.shape)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = models.resnet50(weights="IMAGENET1K_V1")
model.fc = nn.Linear(model.fc.in_features, NUM_ATTRIBUTES)
model = model.to(device)

criterion = nn.BCEWithLogitsLoss()

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-4,
    weight_decay=1e-5
)
def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    running_loss = 0.0

    for imgs, labels in tqdm(loader, desc="Training", leave=False):
        imgs = imgs.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item()

    return running_loss / len(loader)


@torch.no_grad()
def validate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0

    for imgs, labels in tqdm(loader, desc="Validation", leave=False):
        imgs = imgs.to(device)
        labels = labels.to(device)

        outputs = model(imgs)
        loss = criterion(outputs, labels)
        running_loss += loss.item()

    return running_loss / len(loader)


EPOCHS = 100
PATIENCE = 7
min_delta = 1e-4

best_val_loss = float("inf")
epochs_no_improve = 0

ckpt_path = os.path.join(CHECKPOINT_DIR, "pa100k_last.pth")

if os.path.exists(ckpt_path):
    checkpoint = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(checkpoint["model_state"])
    optimizer.load_state_dict(checkpoint["optimizer_state"])
    best_val_loss = checkpoint["val_loss"]
    start_epoch = checkpoint["epoch"] + 1
    print(f"✅ Resumed from epoch {start_epoch}")
else:
    start_epoch = 1

for epoch in range(start_epoch, EPOCHS + 1):
    print(f"\nEpoch {epoch}/{EPOCHS}")

    train_loss = train_one_epoch(
        model, train_loader, optimizer, criterion, device
    )

    val_loss = validate(
        model, val_loader, criterion, device
    )

    print(f"Train Loss: {train_loss:.4f}")
    print(f"Val   Loss: {val_loss:.4f}")

    # Save last checkpoint
    torch.save(
        {
            "epoch": epoch,
            "model_state": model.state_dict(),
            "optimizer_state": optimizer.state_dict(),
            "val_loss": val_loss
        },
        ckpt_path
    )

    # Check improvement
    if val_loss < best_val_loss - min_delta:
        best_val_loss = val_loss
        epochs_no_improve = 0

        torch.save(
            model.state_dict(),
            os.path.join(CHECKPOINT_DIR, "pa100k_best.pth")
        )
        print("✅ Best model saved")

    else:
        epochs_no_improve += 1
        print(f"⚠️ No improvement for {epochs_no_improve} epoch(s)")

    if epochs_no_improve >= PATIENCE:
        print(
            f"\n🛑 Early stopping at epoch {epoch}. "
            f"Best Val Loss: {best_val_loss:.4f}"
        )
        break

import torch
import torchvision.models as models
import torch.nn as nn

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

NUM_ATTRIBUTES = len(ATTRIBUTE_NAMES)

model = models.resnet50(weights=None)
model.fc = nn.Linear(model.fc.in_features, NUM_ATTRIBUTES)

best_ckpt = "/content/drive/MyDrive/model2/checkpoints/pa100k_best.pth"
model.load_state_dict(torch.load(best_ckpt, map_location=device))

model = model.to(device)
model.eval()

print("✅ Model loaded for inference")

