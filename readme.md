# mini-vue 的搭建过程

## 搭建环境

- jest
- typescript
- babel

```shell
yarn add typescript --dev

yarn add jest --dev
yarn add --dev @types/jest

yarn add --dev babel-jest @babel/core @babel/preset-env
yarn add --dev @babel/preset-typescript
```

## esm

在当前工程内使用 esm 模块化，因为当前工程是 node 环境下，可以使用`babel`通过配置 Babel 使其能够兼容当前的 Node 版本。

```js
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
```

使 babel 支持 typescript
将 `@babel/preset-typescript` 添加到 babel.config.js 中的 presets 列表中。

- [jest 配置 babel](https://www.jestjs.cn/docs/getting-started#%E4%BD%BF%E7%94%A8-babel)
- [jest 配置 typescript](https://www.jestjs.cn/docs/getting-started#%E4%BD%BF%E7%94%A8-typescript)
