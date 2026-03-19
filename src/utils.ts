export const COLORS = {
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
} as const

export const utils = {
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
