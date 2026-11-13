# ORBIT REPTILES

紫の宇宙を漂う爬虫類をテーマにした、インタラクティブなショーケースです。
React / Vite / Three.js / Motion / Lenis で実装しています。

## ローカル起動

Node.js と npm を用意して実行します。

```sh
npm ci
npm run dev
```

開発サーバーは通常 `http://localhost:5173/` で起動します。

## ビルド・プレビュー

```sh
npm run build
npm run preview
```

ビルド結果は `dist/` に出力されます。プレビューは通常 `http://localhost:4173/` です。

## 主な機能

- 元の宇宙ヘビが呼吸と小さな揺れを続け、スクロールに合わせて大きく口を開き、手前へ迫る表紙の演出
- アメジストの爬虫類の生命表現
- 星雲、星屑、流星、スクロールに連動する視差と光の演出
- 立体のヘビ・ワニと、翼の骨格アニメーションを持つ龍が惑星を周回
- Sketchfab公式ビューによるカメレオンと4種類の爬虫類の精密3D展示
- ドラッグ回転、ホイール・＋／−ボタン・キーボードによるズーム
- パイソンの作者提供idleアニメーション、レオパ／クレスの微小な呼吸変形
- カテゴリー絞り込み、検索、お気に入りのブラウザー保存、詳細モーダル
- WARP、惑星の共鳴、長押しで発動するSUPERNOVA
- スムーズスクロール、スマホ操作、エフェクト停止、OSの動きを減らす設定
- 任意でオンにする音と全画面表示（音は初期状態オフ）

表紙は `public/images/celestial-serpent.webp` と、同じ蛇の開口用画像を使った2D演出です。スクロールを止めている間も、胴体の呼吸と頭・首・尾の小さな揺れが続きます。頭部の局所変形で開口し、画像全体の拡大・移動で突進を表現します。四辺は画像の明るさに応じてなじませます。エフェクト停止、OSの「動きを減らす」設定、表紙が画面外にある間は常時アニメーションを休止します。表紙に外部3Dモデルは使用しません。末尾のアメジストの爬虫類は画像にシェーダー演出を加えたものです。

展示用のコンセプトサイトです。実際の販売・予約・フォーム送信は行いません。

## 素材・クレジット

- 表紙のヘビ：[宇宙ヘビの画像](public/images/celestial-serpent.webp)を使用。[演出の構成](docs/hero-serpent.md)。
- 惑星を周回するモデル： [出典・ライセンス・加工内容](public/models/orbital/credits.json)。Grab3DのCC0素材と、LasquetiSpiceの龍（CC BY 4.0、afk.ai配布版）などを使用しています。
- 精密3D展示： [モデル情報](public/model-provenance.json)。作者がホストするSketchfab公式ビューを使用し、元モデルのファイルは再配布していません。初回表示には外部サービスへの接続が必要です。
- 画像： [出典記録](public/images/sources.json)。宇宙の参考画像は提供素材をWebPへ変換しています。
- 内蔵画像生成によるアート： [宇宙ヘビ](public/images/celestial-serpent.webp) / [プロンプト](public/images/serpent-prompt.txt)、[アメジストの爬虫類](public/images/amethyst-reptile.webp) / [プロンプト](public/images/amethyst-prompt.txt)。

画面フッターの「ART & EXPERIENCE」からも出典を確認できます。

## 構成

- `src/App.jsx` — ページ、ナビゲーション、コレクション、モーダル
- `src/SerpentPortrait.jsx` / `src/serpent-portrait-morph.js` — 表紙の蛇の呼吸・揺れ・頭部変形と開口
- `src/serpent-hero-stage.css` — 表紙画像とスマホのレイアウト
- `src/ScrollJourney.jsx` / `src/OrbitalCreatures.js` — 惑星と周回する立体モデル
- `src/OfficialModelViewer.jsx` — 公式3Dビューの操作とアニメーション
- `src/LivingPortraitEffect.jsx` — 画像による爬虫類の呼吸・瞬き・光
- `src/UniverseBackdrop.jsx` / `src/SparkleEffects.jsx` — 背景と粒子演出
- `src/useSmoothScroll.js` — スクロールの補間
- `public/models/` / `public/images/` — サイトの素材

`.openai/hosting.json` は既存のSites公開先を示す設定です。別環境への静的ホスティングでは `npm run build` の出力を利用できます。`node_modules/`、`dist/`、ローカル検証用の `.qa/` はGitの対象外です。
