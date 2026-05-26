# tiktokdl-tui

TikTok 下载工具 TUI 版本，支持：

- 获取账号视频清单
- 下载整个账号
- 下载单个视频
- 任务快照
- 失败日志查看
- 环境检查

## 安装

```bash
npm install
python -m pip install -r requirements.txt
```

或者：

```bash
npm run setup
```

## 启动

Windows 推荐使用：

```bat
start.cmd
```

通用方式：

```bash
npm start
```

## 环境检查

```bash
npm run doctor
```

## 说明

- 依赖 Python 和 `yt-dlp`
- 默认下载目录在 `~/.tiktokdl-tui`
- Windows 建议使用支持 UTF-8 的终端

## 参考项目
https://github.com/yt-dlp
