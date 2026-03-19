import { Context } from 'koishi'
import { Config, CacheEntry } from './config'
import { utils } from './utils'

export function parseAddress(input: string): { host: string, port: number } {
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

export async function queryServer(ctx: Context, host: string, port: number, config: Config, cache: Map<string, CacheEntry>): Promise<{ game: string, result: any }> {
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

export async function queryServers(ctx: Context, serversToQuery: string[], config: Config, cache: Map<string, CacheEntry>) {
  const startTime = Date.now()
  const results = await Promise.allSettled(
    serversToQuery.map(async (server, index) => {
      try {
        const { host, port } = parseAddress(server)
        const data = await queryServer(ctx, host, port, config, cache)
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

export function formatServerInfo(data: { game: string, result: any }, config: Config): string {
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

export function formatPlayers(players: any[], maxPlayers: number): string {
  if (!players || players.length === 0) {
    return '👤 服务器当前无在线玩家'
  }

  const sortedPlayers = [...players].sort((a, b) => {
    const nameA = utils.cleanName(a.name).toLowerCase()
    const nameB = utils.cleanName(b.name).toLowerCase()
    return nameA.localeCompare(nameB)
  })

  const displayPlayers = sortedPlayers.slice(0, maxPlayers)
  let message = `👤 在线玩家 (${players.length}人):\n`

  displayPlayers.forEach((player, index) => {
    message += `${index + 1}. ${utils.cleanName(player.name)}\n`
  })

  if (players.length > maxPlayers) {
    message += `... 还有 ${players.length - maxPlayers} 位玩家未显示`
  }

  return message.trim()
}

export function generateTextTable(results: any[], serversToQuery: string[], queryTime: number): string {
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful

  let message = `📊 批量查询结果 (${utils.formatTime(queryTime)})\n`
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

export function resolveAddress(input: string, serverAliases: Record<string, string>): string {
  if (serverAliases && serverAliases[input]) {
    return serverAliases[input]
  }
  return input
}
