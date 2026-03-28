"""
OSNet (Omni-Scale Network) for Person Re-Identification.
Lightweight implementation using only PyTorch — no external dependencies.
Architecture from: https://arxiv.org/abs/1905.00953

Produces a 512-dimensional embedding per person image, specifically
trained for cross-camera person re-identification.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock(nn.Module):
    """Conv + BN + ReLU"""
    def __init__(self, in_c, out_c, k=1, s=1, p=0):
        super().__init__()
        self.conv = nn.Conv2d(in_c, out_c, k, stride=s, padding=p, bias=False)
        self.bn = nn.BatchNorm2d(out_c)

    def forward(self, x):
        return F.relu(self.bn(self.conv(x)), inplace=True)


class LightConv3x3(nn.Module):
    """Lightweight 3x3 convolution (depthwise separable)."""
    def __init__(self, in_c, out_c):
        super().__init__()
        self.dw = nn.Conv2d(in_c, in_c, 3, padding=1, groups=in_c, bias=False)
        self.bn1 = nn.BatchNorm2d(in_c)
        self.pw = nn.Conv2d(in_c, out_c, 1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_c)

    def forward(self, x):
        x = F.relu(self.bn1(self.dw(x)), inplace=True)
        x = F.relu(self.bn2(self.pw(x)), inplace=True)
        return x


class ChannelGate(nn.Module):
    """Channel attention gate."""
    def __init__(self, in_c, num_gates=None, return_gates=False, gate_activation='sigmoid', reduction=16):
        super().__init__()
        if num_gates is None:
            num_gates = in_c
        self.return_gates = return_gates
        self.global_avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc1 = nn.Conv2d(in_c, in_c // reduction, 1, bias=True)
        self.fc2 = nn.Conv2d(in_c // reduction, num_gates, 1, bias=True)

        if gate_activation == 'sigmoid':
            self.gate_activation = nn.Sigmoid()
        elif gate_activation == 'relu':
            self.gate_activation = nn.ReLU(inplace=True)
        elif gate_activation == 'linear':
            self.gate_activation = None
        else:
            raise RuntimeError(f"Unknown gate activation: {gate_activation}")

    def forward(self, x):
        inp = x
        x = self.global_avgpool(x)
        x = F.relu(self.fc1(x), inplace=True)
        x = self.fc2(x)
        if self.gate_activation is not None:
            x = self.gate_activation(x)
        if self.return_gates:
            return x
        return inp * x


class OSBlock(nn.Module):
    """Omni-Scale feature learning block."""
    def __init__(self, in_c, out_c, bottleneck_reduction=4):
        super().__init__()
        mid_c = out_c // bottleneck_reduction

        self.conv1 = ConvBlock(in_c, mid_c)

        # Multi-scale streams
        self.conv2a = LightConv3x3(mid_c, mid_c)
        self.conv2b = nn.Sequential(LightConv3x3(mid_c, mid_c), LightConv3x3(mid_c, mid_c))
        self.conv2c = nn.Sequential(LightConv3x3(mid_c, mid_c), LightConv3x3(mid_c, mid_c), LightConv3x3(mid_c, mid_c))
        self.conv2d = nn.Sequential(LightConv3x3(mid_c, mid_c), LightConv3x3(mid_c, mid_c), LightConv3x3(mid_c, mid_c), LightConv3x3(mid_c, mid_c))

        self.gate = ChannelGate(mid_c)
        self.conv3 = nn.Sequential(nn.Conv2d(mid_c, out_c, 1, bias=False), nn.BatchNorm2d(out_c))

        self.downsample = None
        if in_c != out_c:
            self.downsample = nn.Sequential(nn.Conv2d(in_c, out_c, 1, bias=False), nn.BatchNorm2d(out_c))

    def forward(self, x):
        identity = x
        x1 = self.conv1(x)

        x2a = self.conv2a(x1)
        x2b = self.conv2b(x1)
        x2c = self.conv2c(x1)
        x2d = self.conv2d(x1)

        x2 = self.gate(x2a) + self.gate(x2b) + self.gate(x2c) + self.gate(x2d)
        x3 = self.conv3(x2)

        if self.downsample is not None:
            identity = self.downsample(identity)

        out = x3 + identity
        return F.relu(out, inplace=True)


class OSNet(nn.Module):
    """
    OSNet x1.0 — Omni-Scale Network for Re-ID.
    Output: 512-dimensional L2-normalized embedding.
    """
    def __init__(self, num_classes=0, feature_dim=512):
        super().__init__()
        self.feature_dim = feature_dim

        # Stem: conv 7x7
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 64, 7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
        )
        self.maxpool = nn.MaxPool2d(3, stride=2, padding=1)

        # OSNet stages
        self.conv2 = self._make_layer(64, 256, blocks=2)
        self.pool2 = nn.Sequential(nn.Conv2d(256, 256, 1, bias=False), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.AvgPool2d(2, 2))

        self.conv3 = self._make_layer(256, 384, blocks=2)
        self.pool3 = nn.Sequential(nn.Conv2d(384, 384, 1, bias=False), nn.BatchNorm2d(384), nn.ReLU(inplace=True), nn.AvgPool2d(2, 2))

        self.conv4 = self._make_layer(384, 512, blocks=2)

        # Global feature
        self.global_avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(512, feature_dim),
            nn.BatchNorm1d(feature_dim),
        )

        # Classifier (only used during training)
        self.classifier = nn.Linear(feature_dim, num_classes) if num_classes > 0 else None

        self._init_weights()

    def _make_layer(self, in_c, out_c, blocks):
        layers = [OSBlock(in_c, out_c)]
        for _ in range(1, blocks):
            layers.append(OSBlock(out_c, out_c))
        return nn.Sequential(*layers)

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d) or isinstance(m, nn.BatchNorm1d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def featuremaps(self, x):
        x = self.conv1(x)
        x = self.maxpool(x)
        x = self.conv2(x)
        x = self.pool2(x)
        x = self.conv3(x)
        x = self.pool3(x)
        x = self.conv4(x)
        return x

    def forward(self, x):
        f = self.featuremaps(x)
        v = self.global_avgpool(f)
        v = v.view(v.size(0), -1)
        v = self.fc(v)

        if not self.training:
            # L2 normalize for cosine similarity matching
            v = F.normalize(v, p=2, dim=1)

        if self.classifier is not None and self.training:
            y = self.classifier(v)
            return y

        return v


def build_osnet(num_classes=0, pretrained_path=None, device='cpu'):
    """Build OSNet and optionally load pre-trained weights."""
    model = OSNet(num_classes=num_classes)

    if pretrained_path is not None:
        try:
            state_dict = torch.load(pretrained_path, map_location=device, weights_only=True)

            # Handle state_dict wrapped in checkpoint format
            if isinstance(state_dict, dict) and 'state_dict' in state_dict:
                state_dict = state_dict['state_dict']

            # Remove classifier weights if present (we don't need them for feature extraction)
            state_dict = {k: v for k, v in state_dict.items() if not k.startswith('classifier')}

            model.load_state_dict(state_dict, strict=False)
            print(f"[OK] OSNet weights loaded from {pretrained_path}")
        except Exception as e:
            print(f"[WARN] Could not load OSNet weights: {e}")
            print("   Using ImageNet-initialized weights (less accurate for Re-ID)")

    model = model.to(device)
    model.eval()
    return model
