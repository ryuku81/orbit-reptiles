# 表紙の蛇とスクロール演出

最初の表紙は `public/images/celestial-serpent.webp` の画像です。スクロールすると作者制作の3Dパイソンに切り替わり、開口と接近を再生します。画像と3Dは別素材で、表紙の画像から3Dモデルを生成しているわけではありません。

## 3Dモデル

- モデル：[Blackhead Ball Python](https://sketchfab.com/models/587aff215b4e4bd8939a1748e3ae7c42)
- 作者：[Nestaeric](https://sketchfab.com/Nestaeric)
- モデルUID：`587aff215b4e4bd8939a1748e3ae7c42`
- 攻撃クリップ：`snake|attack_A`（6秒）
- クリップUID：`bd80eab18c8944e88d8f5b44b32ce41b`

Sketchfabの公式埋め込みとViewer APIを使用します。元モデルやテクスチャを抽出・再配布せず、作者が配信するモデルを表示します。読込には外部サービスへの接続が必要です。

体表の拡散色を薄紫へ変更し、鱗のバンプと光沢マップを維持しています。目と口内の材質は保持します。顎の動きは作者の骨格アニメーションで、スクロール位置から `seekTo` で時刻を指定します。カメラの実際の位置・注視点も変化させます。

## 実装

- `src/App.jsx` — 元画像と3Dのクロスフェード、コピーのフェード。
- `public/serpent-viewer.html` — 公式SDKを独立した文書で初期化し、リグとアニメーションを読み込む。
- `src/SerpentEncounter.jsx` — 同一オリジンのビューと接続し、材質、攻撃クリップ、カメラ、停止を制御。
- `src/serpent-hero-stage.css` — 表紙画像と小さい画面のレイアウト。

スクロールを戻すと同じ時刻へ戻ります。停止操作では姿勢を固定し、画面外・非表示タブでは描画を休止します。OSで動きを減らす設定が有効な場合とモデルが読み込めない場合は、元画像を表示します。

## 旧Blender試作

`art/hero-serpent.blend`、`scripts/blender/create_hero_serpent.py`、`public/models/hero/` は旧試作の資料です。現在の表紙アニメーションでは使っていません。現在使用する作者のモデルをBlenderで編集する場合は、作者から編集可能なモデルファイルと利用権を取得する必要があります。
