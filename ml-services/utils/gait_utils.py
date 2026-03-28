"""
Gait frame utilities: sequence building, pad/sample to exactly 30 frames.
"""
import torch
import numpy as np
from PIL import Image
from torchvision import transforms

FRAME_COUNT = 30
GAIT_H, GAIT_W = 64, 44

_gait_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=1),
    transforms.Resize((GAIT_H, GAIT_W)),
    transforms.ToTensor(),   # → (1, H, W), values [0, 1]
])


def build_sequence(frames: list, n: int = FRAME_COUNT) -> torch.Tensor:
    """
    Convert a list of PIL Images to a batched gait tensor.
    Pads by repeating or samples evenly to reach exactly `n` frames.
    Returns shape: (1, n, 1, H, W).
    """
    if not frames:
        raise ValueError("frames list is empty")

    total = len(frames)
    if total < n:
        # Tile to reach n frames
        indices = [i % total for i in range(n)]
    else:
        # Evenly sample n frames
        indices = [int(i * total / n) for i in range(n)]

    tensors = [_gait_transform(frames[i]) for i in indices]  # each (1, H, W)
    seq = torch.stack(tensors, dim=0)   # (n, 1, H, W)
    return seq.unsqueeze(0)             # (1, n, 1, H, W)


def pil_from_bytes(data: bytes) -> Image.Image:
    """Load a PIL image from raw bytes."""
    import io
    return Image.open(io.BytesIO(data)).convert("RGB")
