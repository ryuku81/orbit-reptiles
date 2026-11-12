# 表紙の3Dヘビ

表紙はオリジナルの立体モデルをThree.jsで描画しています。スクロール位置に応じて「浮遊 → 身を引く → 開口 → カメラへ突進 → 通過」が連続し、上に戻すと同じ動きを逆向きに再生します。

## Blenderで編集する

`art/hero-serpent.blend` をBlenderで開きます。タイムラインは1〜121フレーム（30fps）。顎・牙の開閉と胴体の変形を確認できるプレビューアニメーションが入っています。Web上のカメラへの移動、色の反射、スクロール同期は `src/SerpentEncounter.jsx` が制御します。

再生成はプロジェクトルートで実行します。既存のGLB、設定JSON、Blenderファイルを上書きするため、手動で編集した `.blend` は別名で保存してください。

```sh
blender --background --factory-startup --python scripts/blender/create_hero_serpent.py
```

制作時はBlender 5.2.3 LTSを使用。スクリプトは独立したバックグラウンドプロセスで実行し、開いているBlenderのセッションには接続しません。

## Webとの接続

- `public/models/hero/serpent.glb` — 鱗、口内、顎、牙、舌、胴体の形状とプレビューアニメーション。
- `public/models/hero/serpent-contract.json` — 各ノード名、姿勢、顎の最大角度、変形名。
- `src/SerpentEncounter.jsx` — `HeadRig` / `LowerJaw` / `FangL` / `FangR` と `recoil` / `strike` / `gapeHalf` / `gape` を制御。

Blenderで編集する場合、これらの名前と親子関係を維持してください。glTFではYが上、Zがカメラへ向かう方向です。口の中心をレンズへ向けることで、胴体全体の単純な拡大ではなく実際の奥行き移動として突進させています。

描画は画面外・非表示タブで休止し、画素密度に上限を設けています。エフェクト停止時は現在の姿勢を保ち、OSの動きを減らす設定では静止姿勢を表示します。WebGLが使えない場合は画像を表示します。

モデル、形状、材質はこのサイトのために生成したオリジナルです。外部のモデルファイルや画像平面は使用していません。
