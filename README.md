# "PDFren"でもっと豊かに!!
このプログラムは普段PDFを開く際の不満から作り上げた、Chrome拡張機能となっています。​
## 主な機能
・指定したページのジャンプ機能​

・文字選択とコピー​

・左右独立した2画面表示​

・PDF内の数式をLaTex形式でコピー
## 実行環境
・Google Chrome

・Chrome拡張機能が使える端末、主にPC
## 実装方法
1.Releaseブランチからzipファイルをダウンロード

2.Chromeを起動させ、Chromeの拡張機能ページ(chrome://extensions/)を開く

3.右上にあるデベロッパーモードONにしてパッケージ化されていない拡張機能を読み込むをクリック

4.ダウンロードしたzipファイルを解凍し、フォルダー内のpaper-viewer-v1.0という名前のフォルダーを選択

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
