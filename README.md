# "PDFren"でもっと豊かに!!
このプログラムは普段PDFを開く際の不満から作り上げた、Chrome拡張機能となっています。​

---

## 主な機能
- 指定したページのジャンプ機能​

- 文字選択とコピー​

- 左右独立した2画面表示​

- PDF内の数式をLaTex形式でコピー

---

## 実行環境
- Windows
- macOS
- Linux
- PC版Google Chrome
- Chrome拡張機能が利用できるブラウザ環境
## 実装方法

---

1.Releaseブランチからzipファイルをダウンロード

2.Chromeを起動させ、Chromeの拡張機能ページ(chrome://extensions/)を開く

3.右上にあるデベロッパーモードONにしてパッケージ化されていない拡張機能を読み込むをクリック

4.ダウンロードしたzipファイルを解凍し、フォルダー内のpaper-viewer-v1.0という名前のフォルダーを選択

---

## 使用技術

このプロジェクトでは、主に以下の技術を使用しています。

| 技術 | 用途 |
|---|---|
| React | 画面UIの構築 |
| TypeScript | 型安全な実装 |
| Vite | 開発環境・ビルド |
| CSS | レイアウトや表示制御 |
| PDF.js / pdfjs-dist | PDFの読み込み・描画・文字情報取得 |
| Zustand | PDFビューアの状態管理 |
| tesseract.js | OCRによる文字認識 |
| Chrome Extension Manifest V3 | Chrome拡張機能の実装 |

---

## 仕組み

### 1. PDFを自作ビューアで開く

ChromeでPDFを開くと、拡張機能がPDFのURLを検知します。

その後、Chrome標準のPDFビューアではなく、自作ビューアのURLにリダイレクトします。

```txt
PDFのURL
↓
Chrome拡張機能が検知
↓
自作PDFビューアで表示
```

---

# 開発の進め方
(Node.js,Gitをダウンロードしてなかったらする必要がある)

1.Repositoryをclone

VSCodeのターミナルで

```Bash
git clone https://github.com/Taiyo3901/Hackathon.v1.git
```

```Bash
cd Hackathon.v1
```

2. npm install

```Bash
npm install
```

3. 開発サーバ起動

```Bash
npm run dev
```

4. build

```Bash
npm run build
```

5. manifest/backgroundコピー

毎回必要。
```Bash
copy extension\manifest.json dist\
```
```Bash
copy extension\background.js dist\
```

6. Chromeへ読み込み

Chromeで：

chrome://extensions

↓

デベロッパーモード ON

↓

パッケージ化されていない拡張機能を読み込む

↓

distフォルダ選択

8. テスト
適当なPDFファイルを開く
