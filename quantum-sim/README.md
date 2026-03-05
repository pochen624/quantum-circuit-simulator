# ⚛ Quantum Circuit Simulator 量子電路模擬器

Interactive quantum circuit simulator for education.  
互動式量子電路模擬器，適用於量子資訊課程教學。

## Features 功能

- **Quantum Gates**: I, H, X, Y, Z, S, T (single-qubit), CNOT, CZ, SWAP (multi-qubit)
- **Measurement**: Place measurement gates and run simulation
- **Visualization**: Probability histogram and full statevector display
- **Flexible**: Support 1-8 qubits, up to 30 steps
- **Mobile-friendly**: Works on both desktop and mobile browsers

## 部署到 Vercel（推薦，最簡單）

### 步驟一：上傳到 GitHub

1. 到 [github.com](https://github.com) 登入（沒帳號就免費註冊一個）
2. 點右上角 **+** → **New repository**
3. Repository name 填 `quantum-circuit-simulator`
4. 選 **Public**，按 **Create repository**
5. 在你的電腦上打開終端機（Terminal），執行：

```bash
# 解壓縮下載的 zip（如果還沒解壓）
cd quantum-sim

# 初始化 git
git init
git add .
git commit -m "quantum circuit simulator"

# 把 YOUR_USERNAME 換成你的 GitHub 帳號名
git remote add origin https://github.com/YOUR_USERNAME/quantum-circuit-simulator.git
git branch -M main
git push -u origin main
```

### 步驟二：部署到 Vercel

1. 到 [vercel.com](https://vercel.com) 用 GitHub 帳號登入
2. 點 **Add New** → **Project**
3. 找到並選擇 `quantum-circuit-simulator`
4. Framework Preset 選 **Vite**（通常會自動偵測）
5. 按 **Deploy**
6. 等約 1 分鐘，部署完成後會得到一個網址，例如：
   `https://quantum-circuit-simulator.vercel.app`

### 步驟三：分享給學生

把網址分享給學生即可！可以：
- 貼到課程網站
- 課堂上投影 QR Code
- 用 LINE / email 傳給學生

## 本機開發（選用）

```bash
npm install
npm run dev
```

瀏覽器打開 `http://localhost:5173`

## License

MIT — Free for educational use.
