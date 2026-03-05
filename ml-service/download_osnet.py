"""
Download pre-trained OSNet x1.0 weights for person Re-ID.
Weights are from the official torchreid model zoo, trained on ImageNet.

Run: python download_osnet.py
"""
import os
import urllib.request

OSNET_URL = "https://drive.google.com/uc?id=1LaG1EJpHrxdAxKnSCJ_i0u-nbxSAeiFY&export=download&confirm=t"
OSNET_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "osnet_x1_0_imagenet.pth")

def download_osnet():
    if os.path.exists(OSNET_FILE):
        print(f"[OK] OSNet weights already exist: {OSNET_FILE}")
        return OSNET_FILE

    print(f"[DOWNLOAD] Downloading OSNet x1.0 weights...")
    print(f"   Source: {OSNET_URL}")
    print(f"   Target: {OSNET_FILE}")

    try:
        urllib.request.urlretrieve(OSNET_URL, OSNET_FILE)
        size_mb = os.path.getsize(OSNET_FILE) / (1024 * 1024)
        print(f"[OK] Downloaded OSNet weights ({size_mb:.1f} MB)")
        return OSNET_FILE
    except Exception as e:
        print(f"[ERROR] Download failed: {e}")
        print("   Please manually download OSNet weights and place at:")
        print(f"   {OSNET_FILE}")
        return None


if __name__ == "__main__":
    download_osnet()
