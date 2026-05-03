# 法简AI - 智能法律案情解析平台

AI 驱动的法律案情分析 Web MVP，轻量化 · 专业 · 上手即用。

## 目录结构

```
fajian-ai/
├── index.html              # 首页
├── analysis.html           # 案情解析页
├── css/
│   ├── common.css          # 全局样式（CSS 变量、Reset、按钮、表单、卡片）
│   ├── components.css      # 组件样式（弹窗、Toast、Loading、骨架屏、Tab）
│   ├── home.css            # 首页样式
│   └── analysis.css        # 解析页样式
├── js/
│   ├── config.js           # 全局配置（从 env.js 读取）
│   ├── utils.js            # 通用工具函数
│   ├── auth.js             # 权限鉴权模块
│   ├── components.js       # UI 组件（Toast、Modal、Loading、骨架屏）
│   ├── markdown.js         # 轻量 Markdown 渲染器
│   ├── home.js             # 首页逻辑
│   ├── analysis.js         # 解析页核心逻辑
│   └── api/
│       ├── deepseek.js     # DeepSeek API 封装
│       └── vika.js         # 本地JSON数据检索模块
├── laws.json               # 法条数据（本地JSON）
├── interpretations.json    # 司法解释数据（本地JSON）
├── cases.json              # 指导性判例数据（本地JSON）
├── env.js                  # 环境变量（gitignored）
├── env.example.js          # 环境变量模板
├── netlify.toml            # Netlify 部署配置
├── .gitignore
└── README.md
```

## 快速开始（本地运行）

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp env.example.js env.js
```

编辑 `env.js`，填入你的真实 API 密钥：

```js
window.ENV = {
  // DeepSeek API（https://platform.deepseek.com）
  DEEPSEEK_API_KEY: 'sk-xxxxxxxxxxxxxxxx',

  // VIP 密钥白名单（人工手动添加）
  VIP_KEY_WHITELIST: [
    'my-vip-key-001',
    'my-vip-key-002'
  ]
};
```

### 2. 准备数据文件

项目根目录下已有三个空JSON文件，向其中导入法律数据即可：

- `laws.json` — 法条数据
- `interpretations.json` — 司法解释数据
- `cases.json` — 指导性判例数据

### 3. 本地运行

**方式一：使用 VS Code Live Server**
1. 安装 VS Code 插件 `Live Server`
2. 右键 `index.html` → `Open with Live Server`

**方式二：使用 Python**
```bash
python -m http.server 8080
# 访问 http://localhost:8080
```

**方式三：使用 Node.js**
```bash
npx serve .
```

## 部署到 Netlify

### 一键部署

1. 将项目推送到 GitHub 仓库
2. 登录 [Netlify](https://app.netlify.com)
3. 点击 `Add new site` → `Import an existing project` → 选择 GitHub 仓库
4. 部署设置：
   - **Build command**: 留空（纯静态）
   - **Publish directory**: `/`
5. 点击 `Deploy site`

### 配置环境变量（Netlify）

Netlify 不支持 `env.js` 文件方式。部署后需在 Netlify 控制台配置：

1. 进入 `Site settings` → `Environment variables`
2. 由于项目使用 `env.js` 注入 `window.ENV`，建议部署前将真实密钥写入 `env.js`

**安全提示**：`env.js` 已加入 `.gitignore`，不会上传到 GitHub。部署到 Netlify 后，由于是纯静态文件，密钥会暴露在前端代码中。请确保：
- DeepSeek API Key 设置使用额度限制

## JSON 数据文件结构

### 法条表（laws.json）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| 法条分类 | 单行文本 | 如：刑法、民法典 |
| 法条章节 | 单行文本 | 如：总则、分则 |
| 法条序号 | 单行文本 | 如：第232条 |
| 法条原文 | 多行文本 | 法条完整原文 |
| 适用案由 | 单行文本 | 对应案由 |
| 检索关键词 | 单行文本 | 逗号分隔关键词 |

### 司法解释表（interpretations.json）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| 关联法条序号 | 单行文本 | 关联法条 |
| 解释名称 | 单行文本 | 司法解释名称 |
| 发布单位 | 单行文本 | 如：最高人民法院 |
| 解释原文 | 多行文本 | 完整解释原文 |
| 适用场景 | 单行文本 | 适用场景描述 |
| 检索关键词 | 单行文本 | 逗号分隔关键词 |

### 指导性判例表（cases.json）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| 案件类型 | 单行文本 | 如：刑事、民事 |
| 关联法条 | 单行文本 | 关联法条 |
| 案情摘要 | 多行文本 | 案情简要 |
| 裁判要点 | 多行文本 | 裁判核心要点 |
| 判决结果 | 多行文本 | 完整判决 |
| 检索关键词 | 单行文本 | 逗号分隔关键词 |

## VIP 密钥白名单管理

### 添加新密钥

编辑 `env.js` 中的 `VIP_KEY_WHITELIST` 数组：

```js
VIP_KEY_WHITELIST: [
  'my-vip-key-001',
  'my-vip-key-002',
  'new-key-here'     // ← 添加新密钥
]
```

### 密钥规则建议
- 使用足够长的随机字符串（建议 16 位以上）
- 混合大小写字母 + 数字
- 定期更换白名单列表
- 线下人工发放，不提供在线生成功能

## 权限系统说明

| 身份 | 免费解析 | 法条 | 司法解释 | 判例 |
|------|---------|------|---------|------|
| 游客 | 1 次（终身） | 摘要 | 摘要 | 要点 |
| 永久VIP | 无限 | 完整原文 | 完整原文 | 完整判决 |

- 试用次数记录在 `localStorage` + `sessionStorage` 双存储
- 内置签名校验，防止 F12 篡改
- 存储损坏/异常时默认判定次数用尽（防白嫖）
- VIP 身份持久化，刷新/重启浏览器均保留

## 技术栈

- 原生 HTML + CSS + JavaScript（零前端框架依赖）
- DeepSeek-V4-Pro API（AI 案情分析）
- 本地 JSON 文件（法律数据库检索）
- Netlify 静态部署 + API 代理

## 许可

仅供法律学习与研究参考，AI 生成内容不构成法律意见。
