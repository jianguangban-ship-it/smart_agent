import type { TaskTypeConfig } from '@/types/form'

export const TASK_TYPES: TaskTypeConfig[] = [
  { value: 'Story', label: 'Story', color: '#3fb950', bgActive: 'rgba(63, 185, 80, 0.15)' },
  { value: 'Task', label: 'Task', color: '#58a6ff', bgActive: 'rgba(88, 166, 255, 0.15)' },
  { value: 'Bug', label: 'Bug', color: '#f85149', bgActive: 'rgba(248, 81, 73, 0.15)' }
]

export const FIBONACCI_POINTS = [1, 2, 3, 5, 8] as const

export const VEHICLE_OPTIONS = [
  'Platform', 'GWM', 'GWM_DE09', 'GWM_EC15S', 'GWM_EC15G',
  'GWM_EC15SG', 'GWM_B26-A', 'GWM_B26-G'
]

export const PRODUCT_OPTIONS = [
  'EPS', 'IBC', 'IBC1.1',
  'IBC1.2', 'IBC2.0', 'EMB', 'ERC', 'MC01', 'HEM', 'EDC'
]

export const LAYER_OPTIONS = ['SYS', 'SW', 'HW', 'ME']

export const DEFAULT_COMPONENT_HISTORY = [
  'CAN_Driver', 'LIN_Stack', 'Diag_Module', 'PWM_Controller',
  'Flash_Manager', 'OS_Task', 'Calibration', 'CDD_MotCtrl', 'PID_Control'
]
