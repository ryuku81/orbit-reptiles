# ORBIT REPTILES

宇宙をテーマにした爬虫類ショップのコンセプトUI。React / Vite / Three.js / Motionで実装。

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

- 精細な生成ビジュアル、宇宙の粒子・軌道演出、立体カード
- 約4,700枚の鱗を持つオリジナル手続き生成3Dカメレオン。ドラッグ回転・ズーム
- 生体のカテゴリー絞り込み、検索、お気に入り（ブラウザーに保存）
- 生体詳細、FAQ、入力検証付きの相談フォームデモ
- スマホ対応、キーボード操作、動きを減らす設定、アニメーション停止

生体情報・価格はサンプルで、販売・予約・フォーム送信は実装していません。3Dモデルは実個体のスキャンではなくアートモデルです。

画像の出典・ライセンスは `public/images/sources.json` と画面フッターの IMAGE CREDITS を参照。ヒーロー画像は built-in imagegen で生成し、プロンプトを `public/images/prompt.txt` に保存しています。
