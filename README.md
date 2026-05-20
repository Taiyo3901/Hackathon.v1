# ソースコードの実際の動かし方

ダウンロード後「chrome://extensions/」でChromeを開き、デベロッパーモードONにしてパッケージ化されていない拡張機能を読み込むをクリック。そしてこのフォルダーのdistフォルダーを選択。
これで、PDFをChromeで開けば、自作のViewerへ開ける。

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
PowerShellなら：
```PowerShell
copy extension\manifest.json dist\
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
7. テスト
適当なPDFファイルを開く

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
