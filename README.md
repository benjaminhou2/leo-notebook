# Leo Notebook

Leo 的本地学习笔记、作业诊断和学习门户项目。

## 项目内容

- `语文/`、`数学/`、`英文/`：原始素材、教学分析和提升习题。
- `技能/`：项目内学习诊断技能。
- `config/`：学习网站配置源。
- `网站/`：React/Vite 本地学习门户。
- `docs/`：技术方案、使用手册和未来开发计划。

项目需求统一基线见 `docs/项目需求说明.md`，其中包含第一阶段已实现功能、当前问题、第二阶段重点功能和验收标准。

## 本地运行

首次克隆后，复制并修改本地密码配置：

```bash
cp config/auth.example.json config/auth.json
```

启动网站：

```bash
cd 网站
npm install
npm run dev -- --port 5173
```

访问：

```text
http://127.0.0.1:5173/
```

更多说明见 `docs/使用手册.md`。
