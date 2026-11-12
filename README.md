# ORBIT REPTILES

見て、触れて遊ぶための宇宙の爬虫類ショーケース。React / Vite / Three.js / Motionで実装。

## 起動

```sh
npm install
npm run dev
```

## ビルド

```sh
npm run build
npm run preview
```

## 機能

- 提供された紫の宇宙画像を参考にした、画面全体の星雲シェーダー
- スクロール速度に反応する奥行きのある星屑・光跡、ヒーローの視差
- 3,000個の光粒子と発光リングを持つ3D惑星。スクロールで角度・距離・コピーが変化
- 順番に浮かび上がる生体カード、惑星のスクロール回転、セクションの登場演出
- 精細な生成ビジュアル、立体カード
- 約4,700枚の鱗を持つオリジナル手続き生成3Dカメレオン。ドラッグ回転・ズーム
- 生体のカテゴリー絞り込み、検索、お気に入り（ブラウザーに保存）
- 生体詳細、FAQ、入力検証付きの相談フォームデモ
- スマホ対応、キーボード操作、動きを減らす設定、アニメーション停止

生体情報・価格はサンプルで、販売・予約・フォーム送信は実装していません。3Dモデルは実個体のスキャンではなくアートモデルです。

画像の出典・ライセンスは `public/images/sources.json` と画面フッターの IMAGE CREDITS を参照。ヒーロー画像は built-in imagegen で生成し、プロンプトを `public/images/prompt.txt` に保存しています。

宇宙参考画像は提供されたAVIFを表示互換性のためWebPに変換し、`public/images/universe-reference.webp` に保存しています。元の画像ファイルは変更していません。背景・惑星はThree.jsのシェーダーとジオメトリによって描画します。


## インタラクティブな演出

- 紫の宝石爬虫類、真珠色の宇宙ヘビの新しい生成ビジュアル
- カーソルの星屑、クリック・タップの光輪、流星、WARPボタンとWキーによるワープ
- 惑星を共鳴させるリングの発光
- 3Dラボのカラー3種、スペクトルスキャン、鱗の分散・再集合、リセット
- SUPERNOVAの長押しチャージ（キーボードのSpace/Enterにも対応）
- 任意でオンにできる音、全画面表示。音は初期状態オフ

追加画像はbuilt-in imagegenで生成。`public/images/amethyst-reptile.webp` と `celestial-serpent.webp`、プロンプトは `amethyst-prompt.txt` と `serpent-prompt.txt`。実在の生体を撮影・スキャンしたものではなく、幻想的なオリジナルアートです。


### 新しい生成素材（built-in imagegen）

- [アメジストの爬虫類](public/images/amethyst-reptile.webp) / [生成プロンプト](public/images/amethyst-prompt.txt)
- [真珠色の宇宙ヘビ](public/images/celestial-serpent.webp) / [生成プロンプト](public/images/serpent-prompt.txt)

### 確認した操作

ヒーローからのワープ、惑星の共鳴、ラボの3色・スキャン・分解・復元・リセット、ギャラリー詳細・お気に入り、Wキー、音のオン/オフ、全画面、SUPERNOVAの長押し/Enter、375px/390px画面のタップ、OSの低モーション設定の途中切り替えをブラウザで確認。
