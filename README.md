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

- オリジナルの3D宇宙ヘビが、スクロールに合わせて身を引き、顎を開き、カメラへ突進する表紙
- 七色の反射、呼吸、舌の動きと、アメジストの爬虫類の生命表現
- 星雲、星屑、流星、スクロールに連動する視差と光の演出
- 立体のヘビ・ワニと、翼の骨格アニメーションを持つ龍が惑星を周回
- Sketchfab公式ビューによるカメレオンと4種類の爬虫類の精密3D展示
- ドラッグ回転、ホイール・＋／−ボタン・キーボードによるズーム
- パイソンの作者提供idleアニメーション、レオパ／クレスの微小な呼吸変形
- カテゴリー絞り込み、検索、お気に入りのブラウザー保存、詳細モーダル
- WARP、惑星の共鳴、長押しで発動するSUPERNOVA
- スムーズスクロール、スマホ操作、エフェクト停止、OSの動きを減らす設定
- 任意でオンにする音と全画面表示（音は初期状態オフ）

表紙のヘビはBlenderで造形したGLBで、胴体の形状変化、顎と牙の関節、口内の変形をThree.jsで同期させています。逆スクロールで同じ動きを巻き戻せます。画面外では描画を休止し、エフェクト停止はその時点の姿勢を維持します。OSの「動きを減らす」では静止姿勢を表示します。末尾のアメジストの爬虫類は画像にシェーダー演出を加えたものです。

展示用のコンセプトサイトです。実際の販売・予約・フォーム送信は行いません。

## 素材・クレジット

- 表紙の3Dヘビ：オリジナル造形。[Blenderファイル](art/hero-serpent.blend) / [生成スクリプト](scripts/blender/create_hero_serpent.py) / [GLB](public/models/hero/serpent.glb)。編集・再生成手順は[こちら](docs/hero-serpent.md)。
- 惑星を周回するモデル： [出典・ライセンス・加工内容](public/models/orbital/credits.json)。Grab3DのCC0素材と、LasquetiSpiceの龍（CC BY 4.0、afk.ai配布版）などを使用しています。
- 精密3D展示： [モデル情報](public/model-provenance.json)。作者がホストするSketchfab公式ビューを使用し、元モデルのファイルは再配布していません。初回表示には外部サービスへの接続が必要です。
- 画像： [出典記録](public/images/sources.json)。宇宙の参考画像は提供素材をWebPへ変換しています。
- 内蔵画像生成によるアート： [宇宙ヘビ](public/images/celestial-serpent.webp) / [プロンプト](public/images/serpent-prompt.txt)、[アメジストの爬虫類](public/images/amethyst-reptile.webp) / [プロンプト](public/images/amethyst-prompt.txt)。

画面フッターの「ART & EXPERIENCE」からも出典を確認できます。

## 構成

- `src/App.jsx` — ページ、ナビゲーション、コレクション、モーダル
- `src/SerpentEncounter.jsx` — 表紙の3Dモデル、顎・牙・胴体とスクロールの同期
- `src/ScrollJourney.jsx` / `src/OrbitalCreatures.js` — 惑星と周回する立体モデル
- `src/OfficialModelViewer.jsx` — 公式3Dビューの操作とアニメーション
- `src/LivingPortraitEffect.jsx` — 画像による爬虫類の呼吸・瞬き・光
- `src/UniverseBackdrop.jsx` / `src/SparkleEffects.jsx` — 背景と粒子演出
- `src/useSmoothScroll.js` — スクロールの補間
- `public/models/` / `public/images/` — サイトの素材

`.openai/hosting.json` は既存のSites公開先を示す設定です。別環境への静的ホスティングでは `npm run build` の出力を利用できます。`node_modules/`、`dist/`、ローカル検証用の `.qa/` はGitの対象外です。
