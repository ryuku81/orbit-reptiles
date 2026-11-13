# 表紙の蛇とスクロール演出

表紙は、元の宇宙ヘビの絵を使った2Dの開口・突進演出です。`public/images/celestial-serpent.webp` と、同じ絵の頭部を開口させた `public/images/celestial-serpent-strike.png` を使用します。スクロールに合わせて頭部だけを局所的に変形し、目・上下の唇・顎を対応させて口を開きます。胴体・尾・球体は元の絵を保ち、別の3Dモデルには切り替えません。

突進は画像全体のDOM上の拡大・移動で表現します。四辺は画像の明るさに応じたフェザー処理で背景になじませます。これは3Dモデルの骨格アニメーションではありません。

## 実装

- `src/App.jsx` — スクロール進行、画像の拡大・移動、コピーの演出。
- `src/SerpentPortrait.jsx` — 原画と開口用画像の読み込み、描画、停止・動きを減らす設定への対応。
- `src/serpent-portrait-morph.js` — 頭部の対応点、局所変形、四辺のフェザー処理。
- `src/serpent-hero-stage.css` — 表紙画像と小さい画面のレイアウト。

表紙の蛇を表示するために、Sketchfabなどの外部3Dモデルを読み込む必要はありません。描画や画像の読み込みに失敗した場合は原画を表示します。開口用画像の制作記録は [celestial-serpent-strike.txt](assets/celestial-serpent-strike.txt) にあります。カメレオンやコレクションなど、他の3D展示は別機能です。

## 保管している旧試作

`src/SerpentEncounter.jsx` と `public/serpent-viewer.html` は、[Nestaeric](https://sketchfab.com/Nestaeric)制作の[Blackhead Ball Python](https://sketchfab.com/models/587aff215b4e4bd8939a1748e3ae7c42)を公式Viewer APIで表示した試作です。現行の表紙からは呼び出しません。作者のモデルファイルは抽出・再配布していません。

`art/hero-serpent.blend`、`scripts/blender/create_hero_serpent.py`、`public/models/hero/` も旧Blender試作の資料として保管しています。現行の表紙では使っていません。
