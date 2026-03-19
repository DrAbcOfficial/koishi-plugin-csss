import { Context, Schema, h } from 'koishi'
import { } from 'koishi-plugin-gamedig'
import { } from 'koishi-plugin-puppeteer'   // 改为 puppeteer

export const name = 'csss'
export const inject = ['puppeteer', 'gamedig', 'database']   // 注入 puppeteer

export interface Config {
  timeout: number
  cacheTime: number
  maxPlayers: number
  retryCount: number
  showVAC: boolean
  showPassword: boolean
  generateImage: boolean
  imageWidth: number
  imageHeight: number
  fontSize: number
  fontFamily: string
  serverList: string[]
  serverAliases: Record<string, string>
  batchTimeout: number
}

export const Config: Schema<Config> = Schema.object({
  timeout: Schema.number()
    .min(1000)
    .max(30000)
    .default(5000)
    .description('查询超时时间(毫秒)'),

  cacheTime: Schema.number()
    .min(0)
    .max(300000)
    .default(30000)
    .description('缓存时间(毫秒，0为禁用缓存)'),

  maxPlayers: Schema.number()
    .min(0)
    .max(100)
    .default(20)
    .description('最大显示玩家数'),

  retryCount: Schema.number()
    .min(0)
    .max(5)
    .default(2)
    .description('查询失败重试次数'),

  showVAC: Schema.boolean()
    .default(true)
    .description('是否显示VAC状态'),

  showPassword: Schema.boolean()
    .default(true)
    .description('是否显示密码保护信息'),

  generateImage: Schema.boolean()
    .default(true)
    .description('是否生成图片横幅（影响cs和csss命令）'),

  imageWidth: Schema.number()
    .min(600)
    .max(2000)
    .default(1200)
    .description('图片宽度(像素)'),

  imageHeight: Schema.number()
    .min(200)
    .max(2500)
    .default(500)
    .description('图片最小高度(像素)，实际高度会根据内容自适应'),

  fontSize: Schema.number()
    .min(12)
    .max(48)
    .default(24)
    .description('字体大小'),

  fontFamily: Schema.string()
    .default('"JetBrains Mono", monospace')
    .description('字体'),

  serverList: Schema.array(Schema.string())
    .role('table')
    .description('批量查询服务器列表（格式: [地址]:[端口]，每行一个）')
    .default([
      'edgebug.cn:27015',
      'edgebug.cn:27016',
      'edgebug.cn:27017',
      'edgebug.cn:27018',
      'edgebug.cn:27019',
    ]),

  serverAliases: Schema.dict(Schema.string())
    .description('服务器别名映射（格式: 别名=地址:端口）')
    .default({
      '测试': 'edgebug.cn:27015',
      '混战': 'edgebug.cn:27016',
    }),

  batchTimeout: Schema.number()
    .min(1000)
    .max(60000)
    .default(15000)
    .description('批量查询总超时时间(毫秒)'),
})

interface CacheEntry {
  timestamp: number
  data: any
}

// 颜色和样式常量
const COLORS = {
  background: '#ffffff',
  cardBackground: '#f8f9fa',
  text: '#333333',
  textLight: '#666666',
  textLighter: '#999999',
  textWhite: '#ffffff',
  border: '#e5e7eb',
  accent: '#3b82f6',
  accentLight: '#dbeafe',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  pingGreen: '#10b981',
  pingYellow: '#f59e0b',
  pingOrange: '#f97316',
  pingRed: '#ef4444',
  playerOnline: '#10b981',
  playerOffline: '#ef4444',
  title: '#1f2937',
  highlight: '#3b82f6',
  divider: '#e5e7eb',
  timestamp: '#9ca3af',
  gold: '#fbbf24',
  playerName: '#374151',
  shadow: 'rgba(0, 0, 0, 0.1)',
}

// 工具函数集合
const utils = {
  formatPing(ping: number): string {
    if (!ping || ping < 0) return '未知'
    if (ping < 50) return `🟢 ${ping}ms`
    if (ping < 100) return `🟡 ${ping}ms`
    if (ping < 200) return `🟠 ${ping}ms`
    return `🔴 ${ping}ms`
  },

  cleanName(name: string): string {
    return name ? name.replace(/\^[0-9]/g, '').replace(/[\u0000-\u001F]/g, '').trim() : '未知'
  },

  truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  },

  getPingColor(ping: number): string {
    if (ping < 50) return COLORS.pingGreen
    if (ping < 100) return COLORS.pingYellow
    if (ping < 200) return COLORS.pingOrange
    return COLORS.pingRed
  },

  getPlayerColor(count: number): string {
    return count > 0 ? COLORS.playerOnline : COLORS.playerOffline
  },

  formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`
    return `${(ms / 1000).toFixed(0)}秒`
  },
}

export function apply(ctx: Context, config: Config) {
  const cache = new Map<string, CacheEntry>()
  
  // 检查所需插件是否可用
  if (!ctx.gamedig) {
    console.error('koishi-plugin-gamedig 未安装或未启用')
    return ctx.logger('cs-server-status').error('需要安装并启用 koishi-plugin-gamedig 插件')
  }
  if (!ctx.puppeteer) {
    console.error('koishi-plugin-puppeteer 未安装或未启用')
    return ctx.logger('cs-server-status').error('需要安装并启用 koishi-plugin-puppeteer 插件')
  }

  // 通用查询结果处理函数
  async function queryServers(serversToQuery: string[]) {
    const startTime = Date.now()
    const results = await Promise.allSettled(
      serversToQuery.map(async (server, index) => {
        try {
          const { host, port } = parseAddress(server)
          const data = await queryServer(host, port)
          return {
            index: index + 1,
            server,
            success: true,
            data
          }
        } catch (error: any) {
          return {
            index: index + 1,
            server,
            success: false,
            error: error.message
          }
        }
      })
    )
    const endTime = Date.now()
    const queryTime = endTime - startTime

    return { results, queryTime, serversToQuery }
  }

  // 解析地址或别名
  function resolveAddress(input: string): string {
    // 检查是否是别名
    if (config.serverAliases && config.serverAliases[input]) {
      return config.serverAliases[input]
    }
    // 否则直接返回原地址
    return input
  }

  // 通用文本表格生成函数
  function generateTextTable(results: any[], serversToQuery: string[], queryTime: number, title: string = '批量查询结果'): string {
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    let message = `📊 ${title} (${utils.formatTime(queryTime)})\n`
    message += `✅ 成功: ${successful} 个 | ❌ 失败: ${failed} 个\n\n`
    message += '序号 服务器名称       在线人数\n'
    message += '──────────────────────────────\n'

    results.forEach((result, index) => {
      const serverInfo = serversToQuery[index]
      if (result.status === 'fulfilled') {
        const { success, data, error } = result.value

        if (success && data) {
          const { result: serverData } = data
          const serverName = serverData.name ? utils.cleanName(serverData.name) : '未知'
          const playerCount = serverData.players?.length || 0
          const maxPlayers = serverData.maxplayers || 0

          const truncatedName = utils.truncateText(serverName, 20)
          const paddedName = truncatedName.padEnd(20, ' ')

          message += `${(index + 1).toString().padStart(2, ' ')}  ${paddedName} ${playerCount}/${maxPlayers}\n`
        } else {
          message += `${(index + 1).toString().padStart(2, ' ')}  ${serverInfo} ❌ 查询失败: ${error}\n`
        }
      } else {
        message += `${(index + 1).toString().padStart(2, ' ')}  ${serverInfo} ❌ 查询失败\n`
      }
    })

    return message
  }

  function parseAddress(input: string): { host: string, port: number } {
    let address = input.replace(/^(http|https|udp|tcp):\/\//, '')

    if (address.includes('[')) {
      const match = address.match(/^\[([^\]]+)\](?::(\d+))?$/)
      if (match) {
        const host = match[1]
        const port = match[2] ? parseInt(match[2]) : 27015
        if (port >= 1 && port <= 65535) return { host, port }
      }
    }

    const parts = address.split(':')
    if (parts.length === 2) {
      const host = parts[0]
      const port = parseInt(parts[1])
      if (!isNaN(port) && port >= 1 && port <= 65535) return { host, port }
    } else if (parts.length === 1) {
      return { host: parts[0], port: 27015 }
    }

    throw new Error(`无效的地址格式: ${input}\n正确格式: [地址]:[端口] 或 [地址]`)
  }

  async function queryServer(host: string, port: number): Promise<{ game: string, result: any }> {
    const cacheKey = `${host}:${port}`
    const now = Date.now()

    if (config.cacheTime > 0) {
      const cached = cache.get(cacheKey)
      if (cached && now - cached.timestamp < config.cacheTime) {
        return cached.data
      }
    }

    let lastError: Error

    for (let i = 0; i <= config.retryCount; i++) {
      try {
        const result = await ctx.gamedig.query({
          type: 'csgo',
          host,
          port,
          maxAttempts: 1,
          socketTimeout: config.timeout,
          attemptTimeout: config.timeout,
        })

        const data = { game: 'csgo', result }

        if (config.cacheTime > 0) {
          cache.set(cacheKey, { timestamp: now, data })
        }

        return data
      } catch (error) {
        lastError = error
        if (i < config.retryCount) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    throw new Error(`无法连接到服务器: ${lastError?.message || '未知错误'}`)
  }

  function formatServerInfo(data: { game: string, result: any }): string {
    const { result } = data

    const lines = [
      ` Counter-Strike 服务器\n`,
      result.name ? `🏷️ 名称: ${utils.cleanName(result.name)}` : null,
      result.map ? `🗺️ 地图: ${result.map}` : null,
      `👥 玩家: ${result.players?.length || 0}/${result.maxplayers || 0}${result.bots?.length ? ` (${result.bots.length} Bot)` : ''}`,
      config.showPassword && result.password !== undefined ? `🔒 密码: ${result.password ? '是 🔐' : '否 🔓'}` : null,
      result.ping ? `📶 Ping: ${utils.formatPing(result.ping)}` : null,
      result.connect ? `🔗 连接: ${result.connect}` : `📍 地址: ${result.host || '未知'}:${result.port || '未知'}`,
      config.showVAC && result.raw?.secure !== undefined ? `🛡️ VAC: ${result.raw.secure ? '启用 ✅' : '关闭 ❌'}` : null,
    ]

    return lines.filter(Boolean).join('\n')
  }

  function formatPlayers(players: any[]): string {
    if (!players || players.length === 0) {
      return '👤 服务器当前无在线玩家'
    }

    const sortedPlayers = [...players].sort((a, b) => {
      const nameA = utils.cleanName(a.name).toLowerCase()
      const nameB = utils.cleanName(b.name).toLowerCase()
      return nameA.localeCompare(nameB)
    })

    const displayPlayers = sortedPlayers.slice(0, config.maxPlayers)
    let message = `👤 在线玩家 (${players.length}人):\n`

    displayPlayers.forEach((player, index) => {
      message += `${index + 1}. ${utils.cleanName(player.name)}\n`
    })

    if (players.length > config.maxPlayers) {
      message += `... 还有 ${players.length - config.maxPlayers} 位玩家未显示`
    }

    return message.trim()
  }

function generateServerHTML(data: { game: string, result: any }, host: string, port: number): string {
  const { result } = data
  const playerCount = result.players?.length || 0
  const botCount = result.bots?.length || 0
  const maxPlayers = result.maxplayers || 0
  const cleanName = result.name ? utils.cleanName(result.name) : '未知服务器'
  const now = new Date().toLocaleString('zh-CN')

  // 玩家列表 HTML
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

function generateBatchHTML(results: any[], serversToQuery: string[], queryTime: number): string {
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful
  const now = new Date().toLocaleString('zh-CN')

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
      serversHTML += `
        <div class="server-item">
          <div class="server-header">
            <span class="server-index">${index+1}.</span>
            <span class="server-name">${name}</span>
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

    <div class="timestamp">💡 输入 \`cs <服务器地址>\` 查询单个服务器详细信息</div>
  </div>
</body>
</html>`
}
  
async function generateServerImage(data: { game: string, result: any }, host: string, port: number): Promise<Buffer> {
  const html = generateServerHTML(data, host, port)
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

async function generateBatchImage(results: any[], serversToQuery: string[], queryTime: number): Promise<Buffer> {
  const html = generateBatchHTML(results, serversToQuery, queryTime)
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

  // 主命令 - cs [地址:端口] 查询服务器状态
  ctx.command('CS服务器查询 <address>', '查询服务器状态')
    .option('noPlayers', '-n 隐藏玩家列表', { type: Boolean, fallback: false })
    .option('image', '-i 生成图片横幅', { type: Boolean, fallback: false })
    .option('text', '-t 输出文本信息', { type: Boolean, fallback: false })
    .option('clear', '-c 清除缓存', { type: Boolean, fallback: false })
    .action(async ({ session, options }, address) => {
      if (!address) return '使用格式: cs [地址:端口] 或 cs [服务器别名]\n示例: cs 127.0.0.1:27015 / cs edgebug.cn / cs 测试'

      if (options.clear) {
        const count = cache.size
        cache.clear()
        return `已清除 ${count} 条缓存记录`
      }

      try {
        const resolvedAddress = resolveAddress(address)
        const isAlias = resolvedAddress !== address
        const { host, port } = parseAddress(resolvedAddress)
        const data = await queryServer(host, port)

        const shouldGenerateImage = options.image || (config.generateImage && !options.text)

        if (shouldGenerateImage) {
          try {
            const imageBuffer = await generateServerImage(data, host, port)
            return h.image(imageBuffer, 'image/png')
          } catch (imageError) {
            console.error('生成图片失败:', imageError)
            return `生成图片失败: ${imageError.message}，已转为文本输出。\n\n${formatServerInfo(data)}\n\n${formatPlayers(data.result.players || [])}`
          }
        }

        let message = formatServerInfo(data)
        message += '\n\n' + formatPlayers(data.result.players || [])
        return message
      } catch (error) {
        let errorMessage = `查询失败: ${error.message}\n\n`

        if (error.message.includes('无法加载 gamedig')) {
          errorMessage += '请确保已安装 koishi-plugin-gamedig：\n'
          errorMessage += '1. 在插件市场搜索并安装 koishi-plugin-gamedig\n'
          errorMessage += '2. 启用该插件后重启'
        } else if (error.message.includes('无效的地址格式')) {
          errorMessage += '地址格式应为: 地址:端口 或 服务器别名\n'
          errorMessage += '示例: 127.0.0.1:27015 或 edgebug.cn:27015 或 测试\n'
          errorMessage += '如果不指定端口，默认使用 27015'
        } else {
          errorMessage += '请检查：\n'
          errorMessage += '1. 服务器地址和端口是否正确\n'
          errorMessage += '2. 服务器是否已开启并允许查询\n'
          errorMessage += '3. 防火墙是否允许访问\n'
          errorMessage += '4. 服务器是否为CS服务器'
        }

        return errorMessage
      }
    })

  // 检查插件状态和配置
  ctx.command('CS服务器查询.status', '检查插件状态和配置')
    .action(async () => {
      try {
        const gamedigStatus = ctx.gamedig ? '✅ 可用' : '❌ 不可用'
        let puppeteerStatus = '❌ 不可用'
        if (ctx.puppeteer) {
          try {
            // 简单测试渲染功能
            await ctx.puppeteer.render('<div>test</div>')
            puppeteerStatus = '✅ 可用'
          } catch (e) {
            puppeteerStatus = `❌ 不可用: ${e.message}`
          }
        }
        const cacheSize = cache.size

        return `✅ CS服务器查询插件状态\n` +
          `💾 缓存数量: ${cacheSize} 条\n` +
          `🕹️ Gamedig插件: ${gamedigStatus}\n` +
          `🖼️ Puppeteer插件: ${puppeteerStatus}\n` +
          `⚙️ 配置参数:\n` +
          `   超时时间: ${config.timeout}ms\n` +
          `   缓存时间: ${config.cacheTime}ms\n` +
          `   重试次数: ${config.retryCount}\n` +
          `   最大显示玩家数: ${config.maxPlayers}\n` +
          `   显示VAC状态: ${config.showVAC ? '是' : '否'}\n` +
          `   显示密码保护: ${config.showPassword ? '是' : '否'}\n` +
          `   生成图片横幅: ${config.generateImage ? '是' : '否'}\n` +
          `   图片宽度: ${config.imageWidth}px\n` +
          `   图片最小高度: ${config.imageHeight}px\n` +
          `   字体大小: ${config.fontSize}px\n` +
          `   字体: ${config.fontFamily}\n\n` +
          `📝 使用: cs [地址:端口]\n` +
          `📝 选项: -i 生成图片, -t 输出文本, -c 清除缓存`
      } catch (error: any) {
        return `❌ 插件状态异常: ${error.message}\n请确保已安装并启用 koishi-plugin-gamedig 和 koishi-plugin-puppeteer`
      }
    })

  // 帮助命令
  ctx.command('CS服务器查询.help', '查看帮助')
    .action(() => {
      return `🔫 CS服务器查询插件帮助\n\n` +
        `📝 基本用法:\n` +
        `cs [地址:端口] 或 cs [服务器别名]\n` +
        `示例: cs 127.0.0.1:27015 / cs edgebug.cn / cs 测试\n` +
        `🔧 选项:\n` +
        `-i 生成图片横幅\n` +
        `-t 输出文本信息\n` +
        `-c 清除缓存\n\n` +
        `🎯 快捷命令:\n` +
        `csss - 批量查询服务器状态\n` +
        `csss -l 显示配置的服务器列表\n` +
        `csss -al 显示服务器别名列表\n\n` +
        `📋 其他命令:\n` +
        `cs.status - 检查插件状态和配置\n` +
        `cs.help - 显示此帮助\n\n` +
        `💡 提示:\n` +
        `1. 如果不指定端口，默认使用27015\n` +
        `2. 只支持CS服务器查询\n` +
        `3. 可以通过别名快速查询常用服务器\n` +
        `4. 查询结果缓存${config.cacheTime}ms，使用 -c 清除缓存\n` +
        `5. 需要安装 koishi-plugin-gamedig 和 koishi-plugin-puppeteer 插件`
    })

  // 批量查询服务器状态
  ctx.command('CS服务器批量查询', '批量查询服务器状态')
    .option('list', '-l 显示配置的服务器列表', { type: Boolean, fallback: false })
    .option('aliases', '-al 显示服务器别名列表', { type: Boolean, fallback: false })
    .option('add', '-a <address> 添加服务器到列表', { type: String })
    .option('remove', '-r <index> 从列表中移除服务器', { type: Number })
    .option('clear', '-c 清空服务器列表', { type: Boolean, fallback: false })
    .option('image', '-i 生成图片横幅', { type: Boolean, fallback: false })
    .option('text', '-t 输出文本信息', { type: Boolean, fallback: false })
    .action(async ({ session, options }, ...addresses) => {
      // 显示配置的服务器列表
      if (options.list) {
        let listMessage = '📋 配置的服务器列表:\n'
        config.serverList.forEach((server, index) => {
          listMessage += `${index + 1}. ${server}\n`
        })
        return listMessage
      }

      // 显示服务器别名列表
      if (options.aliases) {
        if (!config.serverAliases || Object.keys(config.serverAliases).length === 0) {
          return '📋 当前未配置服务器别名\n请在插件配置中添加别名映射'
        }
        let aliasMessage = '📋 服务器别名列表:\n'
        Object.entries(config.serverAliases).forEach(([alias, address], index) => {
          aliasMessage += `${index + 1}. ${alias} → ${address}\n`
        })
        return aliasMessage
      }

      // 添加服务器到列表
      if (options.add) {
        try {
          parseAddress(options.add)
          config.serverList.push(options.add)
          return `✅ 已添加服务器: ${options.add}\n当前列表: ${config.serverList.length} 个服务器`
        } catch (error) {
          return `❌ 添加失败: ${error.message}\n正确格式: 地址:端口 (例如: 127.0.0.1:27015)`
        }
      }

      // 从列表中移除服务器
      if (options.remove !== undefined) {
        const index = options.remove - 1
        if (index >= 0 && index < config.serverList.length) {
          const removed = config.serverList.splice(index, 1)[0]
          return `✅ 已移除服务器: ${removed}\n当前列表: ${config.serverList.length} 个服务器`
        } else {
          return `❌ 索引无效，请输入 1-${config.serverList.length} 之间的数字`
        }
      }

      // 清空服务器列表
      if (options.clear) {
        const count = config.serverList.length
        config.serverList.length = 0
        return `✅ 已清空服务器列表，共移除 ${count} 个服务器`
      }

      // 确定要查询的服务器列表
      let serversToQuery: string[]
      if (addresses.length > 0) {
        serversToQuery = addresses.map(addr => resolveAddress(addr))
      } else if (config.serverList.length > 0) {
        serversToQuery = config.serverList
      } else {
        return '❌ 没有可查询的服务器\n请使用: csss -a <地址:端口> 添加服务器\n或使用: csss <地址1> <地址2> ... 临时查询'
      }

      // 限制最大查询数量
      const maxServers = 10
      if (serversToQuery.length > maxServers) {
        serversToQuery = serversToQuery.slice(0, maxServers)
        session?.send(`⚠️ 服务器数量超过限制，仅查询前 ${maxServers} 个`)
      }

      try {
        const { results, queryTime } = await queryServers(serversToQuery)
        const shouldGenerateImage = options.image || (config.generateImage && !options.text)

        if (shouldGenerateImage) {
          try {
            const imageBuffer = await generateBatchImage(results, serversToQuery, queryTime)
            return h.image(imageBuffer, 'image/png')
          } catch (imageError) {
            console.error('生成批量查询图片失败:', imageError)
            // 失败后继续返回文本
          }
        }

        let message = generateTextTable(results, serversToQuery, queryTime, '批量查询结果')
        message += '\n📋 输入 `cs <服务器地址>` 查询单个服务器'
        return message
      } catch (error) {
        return `❌ 批量查询失败: ${error.message}`
      }
    })

  // 插件卸载时清理资源
  ctx.on('dispose', () => {
    cache.clear()
  })
}