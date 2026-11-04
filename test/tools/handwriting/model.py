# The reader: a small convolutional network that turns a 32-pixel-high strip of handwriting
# into letter chances for every 4-pixel column step (read with CTC). About half a million weights.
import torch, torch.nn as nn

def cbr(i, o):
    return nn.Sequential(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))

class Res1d(nn.Module):
    def __init__(self, c, d, drop):
        super().__init__()
        self.conv = nn.Conv1d(c, c, 3, padding=d, dilation=d, bias=False)
        self.bn = nn.BatchNorm1d(c)
        self.drop = nn.Dropout(drop)
    def forward(self, x):
        return x + self.drop(torch.relu(self.bn(self.conv(x))))

class Net(nn.Module):
    def __init__(self, C, w=(24, 32, 64, 64, 128), d=160, drop=0.15):
        super().__init__()
        a, b, c, e, f = w
        self.body = nn.Sequential(
            cbr(1, a), nn.MaxPool2d(2),            # 16 x W/2
            cbr(a, b), nn.MaxPool2d(2),            # 8 x W/4
            cbr(b, c), cbr(c, e), nn.MaxPool2d((2, 1)),   # 4 x W/4
            cbr(e, f), nn.MaxPool2d((2, 1)),       # 2 x W/4
        )
        self.proj = nn.Sequential(nn.Conv1d(2 * f, d, 3, padding=1, bias=False), nn.BatchNorm1d(d), nn.ReLU(inplace=True), nn.Dropout(drop))
        self.seq = nn.Sequential(Res1d(d, 2, drop), Res1d(d, 4, drop), Res1d(d, 1, drop))
        self.out = nn.Conv1d(d, C, 1)
    def forward(self, x):                 # x: B,1,32,W  ->  B,T,C logits (T = W/4)
        y = self.body(x)
        B, ch, h, T = y.shape
        y = y.reshape(B, ch * h, T)
        y = self.seq(self.proj(y))
        return self.out(y).transpose(1, 2)
