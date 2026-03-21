import { Context } from 'koishi'
import { Config } from './config'
import { COLORS, utils } from './utils'

export function generateServerHTML(data: { game: string, result: any }, host: string, port: number, config: Config): string {
  const { result } = data
  const playerCount = result.players?.length || 0
  const botCount = result.bots?.length || 0
  const maxPlayers = result.maxplayers || 0
  const cleanName = result.name ? utils.cleanName(result.name) : '未知服务器'
  const now = new Date().toLocaleString('zh-CN')

  let playersHTML = ''
  if (playerCount === 0) {
    playersHTML = `<div class="player-row" style="color: ${COLORS.textLight};">服务器当前无玩家在线</div>`
  } else {
    const sortedPlayers = [...result.players].sort((a, b) =>
      utils.cleanName(a.name).localeCompare(utils.cleanName(b.name))
    )
    const displayPlayers = sortedPlayers.slice(0, config.maxPlayers)

    const needTwoColumns = playerCount > 10
    if (needTwoColumns) {
      const half = Math.ceil(displayPlayers.length / 2)
      const left = displayPlayers.slice(0, half)
      const right = displayPlayers.slice(half, half * 2)
      playersHTML = '<div style="display: flex; gap: 40px;">'
      playersHTML += '<div>' + left.map(p => 
        `<div class="player-row">${utils.truncateText(utils.cleanName(p.name), 30)}</div>`
      ).join('') + '</div>'
      playersHTML += '<div>' + right.map(p => 
        `<div class="player-row">${utils.truncateText(utils.cleanName(p.name), 30)}</div>`
      ).join('') + '</div>'
      playersHTML += '</div>'
    } else {
      playersHTML = displayPlayers.map(p => 
        `<div class="player-row">${utils.truncateText(utils.cleanName(p.name), 40)}</div>`
      ).join('')
    }

    if (playerCount > config.maxPlayers) {
      playersHTML += `<div class="player-row" style="color: ${COLORS.textLight}; font-style: italic;">... 还有 ${playerCount - config.maxPlayers} 位玩家未显示</div>`
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${COLORS.background};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", ${config.fontFamily}, sans-serif;
      width: ${config.imageWidth}px;
      min-height: ${config.imageHeight}px;
      padding: 0;
      color: ${COLORS.text};
    }

    .card {
      background: ${COLORS.cardBackground};
      border-radius: 0;
      padding: 32px;
      border: none;
      height: 100%;
    }

    .title {
      text-align: center;
      font-size: ${config.fontSize * 1.3}px;
      font-weight: 600;
      color: ${COLORS.textLight};
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }

    .server-name {
      text-align: center;
      font-size: ${config.fontSize * 1.5}px;
      font-weight: 700;
      color: ${COLORS.title};
      margin: 12px 0 20px;
      word-break: break-word;
      padding: 0 10px;
    }

    .divider {
      height: 1px;
      background: ${COLORS.divider};
      margin: 20px 0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 20px 0;
    }

    .info-item {
      background: ${COLORS.background};
      padding: 14px 18px;
      border-radius: 0;
      font-size: ${config.fontSize}px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid ${COLORS.border};
    }

    .info-label {
      font-size: ${config.fontSize * 0.85}px;
      color: ${COLORS.textLight};
      font-weight: 500;
    }

    .info-value {
      font-size: ${config.fontSize * 1.05}px;
      font-weight: 600;
      color: ${COLORS.text};
    }

    .player-section {
      margin-top: 24px;
    }

    .player-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding: 0 4px;
    }

    .player-section-title {
      font-size: ${config.fontSize * 1.1}px;
      font-weight: 600;
      color: ${COLORS.title};
    }

    .player-count-badge {
      background: ${COLORS.accentLight};
      color: ${COLORS.accent};
      padding: 4px 12px;
      border-radius: 20px;
      font-size: ${config.fontSize * 0.9}px;
      font-weight: 600;
    }

    .player-list {
      background: ${COLORS.background};
      border-radius: 0;
      padding: 16px 20px;
      border: 1px solid ${COLORS.border};
    }

    .player-row {
      font-size: ${config.fontSize * 0.95}px;
      color: ${COLORS.playerName};
      line-height: 2;
      padding: 4px 8px;
      border-radius: 0;
    }

    .player-row:hover {
      background: ${COLORS.cardBackground};
    }

    .timestamp {
      margin-top: 24px;
      font-size: ${config.fontSize * 0.8}px;
      color: ${COLORS.timestamp};
      text-align: center;
      padding-top: 16px;
      border-top: 1px solid ${COLORS.divider};
    }

    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">🎮 服务器状态</div>
    <div class="server-name">${cleanName}</div>
    <div class="divider"></div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">🗺️ 地图</span>
        <span class="info-value">${result.map || '未知'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">📡 IP地址</span>
        <span class="info-value">${host}:${port}</span>
      </div>
      <div class="info-item">
        <span class="info-label">👥 在线人数</span>
        <span class="info-value" style="color: ${utils.getPlayerColor(playerCount)};">
          <span class="status-indicator" style="background: ${utils.getPlayerColor(playerCount)};"></span>
          ${playerCount}/${maxPlayers}${botCount ? ` (+${botCount}Bot)` : ''}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">📶 延迟</span>
        <span class="info-value" style="color: ${utils.getPingColor(result.ping)};">
          ${result.ping ? result.ping + 'ms' : '未知'}
        </span>
      </div>
    </div>

    <div class="player-section">
      <div class="player-section-header">
        <div class="player-section-title">在线玩家</div>
        <div class="player-count-badge">${playerCount}人</div>
      </div>
      <div class="divider" style="margin: 10px 0;"></div>
      <div class="player-list">
        ${playersHTML}
      </div>
    </div>

    <div class="timestamp">查询时间: ${now}</div>
  </div>
</body>
</html>`
}

export function generateBatchHTML(results: any[], serversToQuery: string[], queryTime: number, mainCmd: string, config: Config): string {
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful
  const now = new Date().toLocaleString('zh-CN')

  function findAlias(serverAddress: string): string | null {
    if (!config.serverAliases) return null
    const address = serverAddress.includes(':') ? serverAddress : `${serverAddress}:27015`
    for (const [alias, addr] of Object.entries(config.serverAliases)) {
      if (addr === address) return alias
    }
    return null
  }

  let serversHTML = ''
  results.forEach((result, index) => {
    const server = serversToQuery[index]
    if (result.status === 'fulfilled' && result.value.success) {
      const data = result.value.data.result
      const name = data.name ? utils.cleanName(data.name) : '未知'
      const playerCount = data.players?.length || 0
      const maxPlayers = data.maxplayers || 0
      const map = data.map || ''
      const ping = data.ping || '?'
      const pingColor = utils.getPingColor(ping)
      const playerColor = playerCount > 0 ? COLORS.success : COLORS.error
      const alias = findAlias(server)

      const aliasBadge = alias ? `<span class="alias-badge">${alias}</span>` : ''

      serversHTML += `
        <div class="server-item">
          <div class="server-header">
            <span class="server-index">${index+1}.</span>
            <span class="server-name">${name}${aliasBadge}</span>
            <span class="server-players" style="color: ${playerColor};">${playerCount}/${maxPlayers}</span>
          </div>
          <div class="server-details">
            <span class="server-addr">${server}</span>
            <span class="server-map">地图: ${map}</span>
            <span class="server-ping" style="color: ${pingColor};">延迟: ${ping}ms</span>
          </div>
        </div>
      `
    } else {
      const errorMsg = result.value?.error || '未知错误'
      serversHTML += `
        <div class="server-item error">
          <div class="server-header">
            <span class="server-index">${index+1}.</span>
            <span class="server-name">${server}</span>
            <span class="server-status">❌ 查询失败</span>
          </div>
          <div class="server-details error-msg">${errorMsg}</div>
        </div>
      `
    }
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${COLORS.background};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", ${config.fontFamily}, sans-serif;
      width: ${config.imageWidth}px;
      min-height: ${config.imageHeight}px;
      padding: 0;
      color: ${COLORS.text};
    }

    .card {
      background: ${COLORS.cardBackground};
      border-radius: 0;
      padding: 32px;
      border: none;
      height: 100%;
    }

    .title {
      text-align: center;
      font-size: ${config.fontSize * 1.4}px;
      font-weight: 700;
      color: ${COLORS.title};
      margin-bottom: 16px;
    }

    .stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${COLORS.background};
      padding: 14px 20px;
      border-radius: 0;
      font-size: ${config.fontSize * 0.95}px;
      margin-bottom: 20px;
      border: 1px solid ${COLORS.border};
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: ${COLORS.textLight};
    }

    .stat-value {
      font-weight: 600;
      color: ${COLORS.text};
    }

    .divider {
      height: 1px;
      background: ${COLORS.divider};
      margin: 20px 0 24px;
    }

    .server-item {
      margin-bottom: 16px;
      background: ${COLORS.background};
      border-radius: 0;
      padding: 18px 22px;
      border: 1px solid ${COLORS.border};
    }

    .server-item:last-child {
      margin-bottom: 0;
    }

    .server-item.error {
      border-left: 4px solid ${COLORS.error};
      background: ${COLORS.errorLight};
    }

    .server-header {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: ${config.fontSize * 1.1}px;
      font-weight: 600;
      color: ${COLORS.title};
      margin-bottom: 10px;
    }

    .server-index {
      background: ${COLORS.accentLight};
      color: ${COLORS.accent};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${config.fontSize * 0.85}px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .server-item.error .server-index {
      background: ${COLORS.errorLight};
      color: ${COLORS.error};
    }

    .server-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .server-item.error .server-name {
      color: ${COLORS.error};
    }

    .server-players {
      background: ${COLORS.successLight};
      color: ${COLORS.success};
      padding: 6px 14px;
      border-radius: 20px;
      font-size: ${config.fontSize * 0.9}px;
      font-weight: 600;
      white-space: nowrap;
    }

    .server-status {
      background: ${COLORS.errorLight};
      color: ${COLORS.error};
      padding: 6px 14px;
      border-radius: 20px;
      font-size: ${config.fontSize * 0.9}px;
      font-weight: 600;
    }

    .alias-badge {
      background: ${COLORS.warningLight};
      color: ${COLORS.warning};
      padding: 4px 12px;
      border-radius: 20px;
      font-size: ${config.fontSize * 0.9}px;
      font-weight: 600;
      margin-left: 8px;
      white-space: nowrap;
    }

    .server-details {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: ${config.fontSize * 0.9}px;
      color: ${COLORS.textLight};
      padding-left: 40px;
    }

    .server-details span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .error-msg {
      color: ${COLORS.error};
      font-size: ${config.fontSize * 0.95}px;
      padding-left: 40px;
      margin-top: 4px;
    }

    .timestamp {
      margin-top: 20px;
      font-size: ${config.fontSize * 0.8}px;
      color: ${COLORS.timestamp};
      text-align: center;
      padding-top: 16px;
      border-top: 1px solid ${COLORS.divider};
    }

    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 4px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">🎮 服务器状态批量查询</div>

    <div class="stats">
      <div class="stat-item">
        <span class="stat-value">${now}</span>
        <span>查询时间</span>
      </div>
      <div class="stat-item">
        <span>耗时</span>
        <span class="stat-value">${utils.formatTime(queryTime)}</span>
      </div>
      <div class="stat-item">
        <span>成功</span>
        <span class="stat-value">${successful}/${results.length}</span>
      </div>
    </div>

    <div class="divider"></div>

    ${serversHTML}

    <div class="timestamp">💡 输入 \`${mainCmd} <服务器地址>\` 查询单个服务器详细信息</div>
  </div>
</body>
</html>`
}

export async function generateServerImage(ctx: Context, data: { game: string, result: any }, host: string, port: number, config: Config): Promise<Buffer> {
  const html = generateServerHTML(data, host, port, config)
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({
      width: config.imageWidth,
      height: config.imageHeight,
      deviceScaleFactor: 2,
    })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const buffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    })
    return buffer
  } finally {
    await page.close().catch(() => {})
  }
}

export async function generateBatchImage(ctx: Context, results: any[], serversToQuery: string[], queryTime: number, mainCmd: string, config: Config): Promise<Buffer> {
  const html = generateBatchHTML(results, serversToQuery, queryTime, mainCmd, config)
  const page = await ctx.puppeteer.page()
  try {
    await page.setViewport({
      width: config.imageWidth,
      height: config.imageHeight,
      deviceScaleFactor: 2,
    })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const buffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    })
    return buffer
  } finally {
    await page.close().catch(() => {})
  }
}
