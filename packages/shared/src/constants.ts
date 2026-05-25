export const WS_NAMESPACE = '/classroom'

export const HEARTBEAT_INTERVAL = 15_000

export const TASK_DEFAULT_TIME_LIMIT = 300

export const MAX_GROUP_SIZE = 8

export const SLIDE_TRANSITION_DURATION = 300

export const API_PREFIX = '/api/v1'

export const SUBJECT_TEMPLATES = {
  INDUSTRIAL_ROBOT: 'industrial_robot',
  DIGITAL_DESIGN: 'digital_design',
  SMART_CONTROL: 'smart_control',
  COMPUTER_NETWORK: 'computer_network',
  NEW_ENERGY_VEHICLE: 'new_energy_vehicle',
  APPLIED_CHEMISTRY: 'applied_chemistry',
  DIGITAL_MEDIA: 'digital_media',
  SMART_MANUFACTURING: 'smart_manufacturing',
  ELECTRICAL_AUTOMATION: 'electrical_automation',
  INFO_SECURITY: 'info_security',
} as const

export const COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1890ff',
  mastered: '#52c41a',
  practicing: '#faad14',
  needsImprovement: '#ff4d4f',
} as const
