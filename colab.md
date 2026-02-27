from google.colab import drive
drive.mount("/content/drive", force_remount=True)

!pip install -q kagglehub
import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
import torchvision.models as models
from PIL import Image
from tqdm import tqdm
class PA100KDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None):
        import pandas as pd
        self.df = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        img_name = self.df.iloc[idx, 0]
        img_path = os.path.join(self.img_dir, img_name)

        image = Image.open(img_path).convert("RGB")
        if self.transform:
            image = self.transform(image)

        return image, img_name
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
transform = transforms.Compose([
    transforms.Resize((224, 112)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

import os

# Correcting TEST_CSV to point to the KaggleHub downloaded dataset path
# The 'path' variable should be available from a previous cell's execution.
# Assuming 'path' is '/root/.cache/kagglehub/datasets/yuulind/pa-100k/versions/1'
CORRECTED_BASE_DIR = os.path.join(path, "PA-100K")
TEST_CSV = os.path.join(CORRECTED_BASE_DIR, "test.csv")

test_dataset = PA100KDataset(TEST_CSV, IMG_DIR, transform)

test_loader = DataLoader(
    test_dataset,
    batch_size=64,
    shuffle=False,
    num_workers=2,
    pin_memory=True
)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

import pandas as pd
NUM_ATTRIBUTES = len(pd.read_csv(TEST_CSV).columns) - 1

model = models.resnet50(weights=None)
model.fc = nn.Linear(model.fc.in_features, NUM_ATTRIBUTES)

ckpt_path = "/content/drive/MyDrive/model2/checkpoints/pa100k_best.pth"
model.load_state_dict(torch.load(ckpt_path, map_location=device))

model = model.to(device)
model.eval()

print("✅ PA-100K model loaded")
@torch.no_grad()
def extract_attributes(model, loader, device):
    all_attributes = []
    all_img_names = []

    for imgs, img_names in tqdm(loader, desc="Extracting PA-100K attributes"):
        imgs = imgs.to(device)

        outputs = model(imgs)
        probs = torch.sigmoid(outputs)

        all_attributes.append(probs.cpu().numpy())
        all_img_names.extend(img_names)

    return np.vstack(all_attributes), all_img_names
attributes, img_names = extract_attributes(
    model, test_loader, device
)

np.save(os.path.join(SAVE_DIR, "pa100k_attributes.npy"), attributes)
np.save(os.path.join(SAVE_DIR, "pa100k_image_names.npy"), img_names)

print("✅ PA-100K embeddings saved to:", SAVE_DIR)
print("Attributes shape:", attributes.shape)
