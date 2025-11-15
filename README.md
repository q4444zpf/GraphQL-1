# GraphQL + Vue3 图书管理示例

本示例演示如何使用 Vue 3 结合一个简易的 GraphQL 接口实现图书的增删改查功能。项目完全依赖浏览器和 Node.js 自带能力，无需额外安装 npm 依赖，适合在受限网络环境下体验 GraphQL 的基本流程。

## 目录结构

- `server/`：使用 Node.js 原生 `http` 模块实现的轻量 GraphQL 解析与数据处理逻辑，提供 `books` 查询及增删改查 Mutation，并将数据持久化到 `server/data/books.json`，重启服务后仍能保留测试数据。
- `client/`：纯静态的前端页面，借助浏览器通过 GraphQL 请求与服务端交互，界面由 Vue 3 组合式 API 构建。

## 运行步骤

1. **启动 GraphQL 服务**

   在仓库根目录执行：

   ```bash
   cd server
   node index.js
   ```

   服务启动后会监听在 `http://localhost:4000/graphql`，控制台会打印访问地址。

   - 如果需要重置演示数据，可删除 `server/data/books.json` 文件，下一次启动时会自动恢复默认书籍列表。

2. **启动前端页面**

   可以选择以下任一方式：

   - 使用 Python 内置服务器：

     ```bash
     cd client
     python3 -m http.server 5173
     ```

     然后在浏览器访问 `http://localhost:5173`。

   - 或直接双击打开 `client/index.html`，浏览器将通过 CORS 访问后端接口。（推荐使用现代浏览器以获得更好的体验。）

3. **体验功能**

   - 页面加载后会自动查询并显示现有图书。
   - 在“新增图书”表单中填写信息后提交即可新增。
   - 点击列表中的“编辑”可对条目进行修改，“保存”后会更新。
   - 点击“删除”会移除对应图书。
   - 若出现错误或网络请求失败，会在表格上方显示提示，可点击“刷新”重新获取数据。

## 技术要点

- 服务端针对固定的查询/Mutation 名称进行了轻量解析，确保在无第三方依赖的情况下也能完成 GraphQL 协议交互。
- 前端使用 Vue 3 组合式 API 管理状态，并通过原生 `fetch` 发送 GraphQL 请求，兼顾易读性与可维护性。
- 所有数据默认持久化在 `server/data/books.json` 中，方便理解 GraphQL 调用流程，实际项目可替换为数据库或其他持久化方案。
