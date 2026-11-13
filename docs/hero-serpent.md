# 表紙の蛇とスクロール演出

表紙のスクロール区間は、最初から最後まで `public/images/celestial-serpent.webp` を表示します。別の3Dモデルへのクロスフェードや、3Dの開口・突進演出は使用しません。

## 実装

- `src/App.jsx` — 表紙画像の表示とスクロールに連動するコピーの演出。
- `src/serpent-hero-stage.css` — 表紙画像と小さい画面のレイアウト。

表紙の蛇を表示するために、Sketchfabのモデルを読み込む必要はありません。カメレオンやコレクションなど、他の3D展示は別機能です。

## 保管している旧試作

`src/SerpentEncounter.jsx` と `public/serpent-viewer.html` は、[Nestaeric](https://sketchfab.com/Nestaeric)制作の[Blackhead Ball Python](https://sketchfab.com/models/587aff215b4e4bd8939a1748e3ae7c42)を公式Viewer APIで表示した試作です。現行の表紙からは呼び出しません。作者のモデルファイルは抽出・再配布していません。

`art/hero-serpent.blend`、`scripts/blender/create_hero_serpent.py`、`public/models/hero/` も旧Blender試作の資料として保管しています。現行の表紙では使っていません。
