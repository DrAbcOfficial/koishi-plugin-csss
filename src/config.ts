import { Schema } from 'koishi'

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

export interface CacheEntry {
  timestamp: number
  data: any
}
