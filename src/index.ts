import { Context, Schema, h } from 'koishi'
import { } from 'koishi-plugin-gamedig'
import { } from 'koishi-plugin-puppeteer'

export const name = 'csss'
export const inject = ['puppeteer', 'gamedig', 'database']

import { Config, CacheEntry } from './config'
import * as imageModule from './image'
import * as serverModule from './server'

export { Config }

function apply(ctx: Context, config: Config) {
  const cache = new Map<string, CacheEntry>()

  if (!ctx.gamedig) {
    console.error('koishi-plugin-gamedig 未安装或未启用')
    return ctx.logger('cs-server-status').error('需要安装并启用 koishi-plugin-gamedig 插件')
  }
  if (!ctx.puppeteer) {
    console.error('koishi-plugin-puppeteer 未安装或未启用')
    return ctx.logger('cs-server-status').error('需要安装并启用 koishi-plugin-puppeteer 插件')
  }

  const mainCommand = ctx.command('CS服务器查询 <address>', '查询服务器状态')
  const statusCommand = ctx.command('CS服务器查询.status', '检查插件状态和配置')
  const helpCommand = ctx.command('CS服务器查询.help', '查看帮助')
  const batchCommand = ctx.command('CS服务器批量查询', '批量查询服务器状态')

  const mainCmd = mainCommand.name || 'cs'
  const statusCmd = statusCommand.name || 'cs.status'
  const helpCmd = helpCommand.name || 'cs.help'
  const batchCmd = batchCommand.name || 'csss'

  mainCommand
    .option('noPlayers', '-n 隐藏玩家列表', { type: Boolean, fallback: false })
    .option('image', '-i 生成图片横幅', { type: Boolean, fallback: false })
    .option('text', '-t 输出文本信息', { type: Boolean, fallback: false })
    .option('clear', '-c 清除缓存', { type: Boolean, fallback: false })
    .action(async ({ session, options }, address) => {
      if (!address) return `使用格式: ${mainCmd} [地址:端口] 或 ${mainCmd} [服务器别名]\n示例: ${mainCmd} 127.0.0.1:27015 / ${mainCmd} edgebug.cn / ${mainCmd} 测试`

      if (options.clear) {
        const count = cache.size
        cache.clear()
        return `已清除 ${count} 条缓存记录`
      }

      try {
        const resolvedAddress = serverModule.resolveAddress(address, config.serverAliases)
        const { host, port } = serverModule.parseAddress(resolvedAddress)
        const data = await serverModule.queryServer(ctx, host, port, config, cache)

        const shouldGenerateImage = options.image || (config.generateImage && !options.text)

        if (shouldGenerateImage) {
          try {
            const imageBuffer = await imageModule.generateServerImage(ctx, data, host, port, config)
            return h.image(imageBuffer, 'image/png')
          } catch (imageError) {
            console.error('生成图片失败:', imageError)
            return `生成图片失败: ${imageError.message}，已转为文本输出。\n\n${serverModule.formatServerInfo(data, config)}\n\n${serverModule.formatPlayers(data.result.players || [], config.maxPlayers)}`
          }
        }

        let message = serverModule.formatServerInfo(data, config)
        message += '\n\n' + serverModule.formatPlayers(data.result.players || [], config.maxPlayers)
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

  statusCommand
    .action(async () => {
      try {
        const gamedigStatus = ctx.gamedig ? '✅ 可用' : '❌ 不可用'
        let puppeteerStatus = '❌ 不可用'
        if (ctx.puppeteer) {
          try {
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
          `📝 使用: ${mainCmd} [地址:端口]\n` +
          `📝 选项: -i 生成图片, -t 输出文本, -c 清除缓存`
      } catch (error: any) {
        return `❌ 插件状态异常: ${error.message}\n请确保已安装并启用 koishi-plugin-gamedig 和 koishi-plugin-puppeteer`
      }
    })

  helpCommand
    .action(() => {
      return `🔫 CS服务器查询插件帮助\n\n` +
        `📝 基本用法:\n` +
        `${mainCmd} [地址:端口] 或 ${mainCmd} [服务器别名]\n` +
        `示例: ${mainCmd} 127.0.0.1:27015 / ${mainCmd} edgebug.cn / ${mainCmd} 测试\n` +
        `🔧 选项:\n` +
        `-i 生成图片横幅\n` +
        `-t 输出文本信息\n` +
        `-c 清除缓存\n\n` +
        `🎯 快捷命令:\n` +
        `${batchCmd} - 批量查询服务器状态\n` +
        `${batchCmd} -l 显示配置的服务器列表\n` +
        `${batchCmd} -al 显示服务器别名列表\n\n` +
        `📋 其他命令:\n` +
        `${statusCmd} - 检查插件状态和配置\n` +
        `${helpCmd} - 显示此帮助\n\n` +
        `💡 提示:\n` +
        `1. 如果不指定端口，默认使用27015\n` +
        `2. 只支持CS服务器查询\n` +
        `3. 可以通过别名快速查询常用服务器\n` +
        `4. 查询结果缓存${config.cacheTime}ms，使用 -c 清除缓存\n` +
        `5. 需要安装 koishi-plugin-gamedig 和 koishi-plugin-puppeteer 插件`
    })

  batchCommand
    .option('list', '-l 显示配置的服务器列表', { type: Boolean, fallback: false })
    .option('aliases', '-al 显示服务器别名列表', { type: Boolean, fallback: false })
    .option('add', '-a <address> 添加服务器到列表', { type: String })
    .option('remove', '-r <index> 从列表中移除服务器', { type: Number })
    .option('clear', '-c 清空服务器列表', { type: Boolean, fallback: false })
    .option('image', '-i 生成图片横幅', { type: Boolean, fallback: false })
    .option('text', '-t 输出文本信息', { type: Boolean, fallback: false })
    .action(async ({ session, options }, ...addresses) => {
      if (options.list) {
        let listMessage = '📋 配置的服务器列表:\n'
        config.serverList.forEach((server, index) => {
          listMessage += `${index + 1}. ${server}\n`
        })
        return listMessage
      }

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

      if (options.add) {
        try {
          serverModule.parseAddress(options.add)
          config.serverList.push(options.add)
          return `✅ 已添加服务器: ${options.add}\n当前列表: ${config.serverList.length} 个服务器`
        } catch (error) {
          return `❌ 添加失败: ${error.message}\n正确格式: 地址:端口 (例如: 127.0.0.1:27015)`
        }
      }

      if (options.remove !== undefined) {
        const index = options.remove - 1
        if (index >= 0 && index < config.serverList.length) {
          const removed = config.serverList.splice(index, 1)[0]
          return `✅ 已移除服务器: ${removed}\n当前列表: ${config.serverList.length} 个服务器`
        } else {
          return `❌ 索引无效，请输入 1-${config.serverList.length} 之间的数字`
        }
      }

      if (options.clear) {
        const count = config.serverList.length
        config.serverList.length = 0
        return `✅ 已清空服务器列表，共移除 ${count} 个服务器`
      }

      let serversToQuery: string[]
      if (addresses.length > 0) {
        serversToQuery = addresses.map(addr => serverModule.resolveAddress(addr, config.serverAliases))
      } else if (config.serverList.length > 0) {
        serversToQuery = config.serverList
      } else {
        return `❌ 没有可查询的服务器\n请使用: ${batchCmd} -a <地址:端口> 添加服务器\n或使用: ${batchCmd} <地址1> <地址2> ... 临时查询`
      }

      const maxServers = 10
      if (serversToQuery.length > maxServers) {
        serversToQuery = serversToQuery.slice(0, maxServers)
        session?.send(`⚠️ 服务器数量超过限制，仅查询前 ${maxServers} 个`)
      }

      try {
        const { results, queryTime } = await serverModule.queryServers(ctx, serversToQuery, config, cache)
        const shouldGenerateImage = options.image || (config.generateImage && !options.text)

        if (shouldGenerateImage) {
          try {
            const imageBuffer = await imageModule.generateBatchImage(ctx, results, serversToQuery, queryTime, mainCmd, config)
            return h.image(imageBuffer, 'image/png')
          } catch (imageError) {
            console.error('生成批量查询图片失败:', imageError)
          }
        }

        let message = serverModule.generateTextTable(results, serversToQuery, queryTime)
        message += `\n📋 输入 \`${mainCmd} <服务器地址>\` 查询单个服务器`
        return message
      } catch (error) {
        return `❌ 批量查询失败: ${error.message}`
      }
    })

  ctx.on('dispose', () => {
    cache.clear()
  })
}

export { apply }
