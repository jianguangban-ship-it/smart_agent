import type { TaskTypeConfig } from '@/types/form'

export const TASK_TYPES: TaskTypeConfig[] = [
  { value: 'Story', label: 'Story', color: '#3fb950', bgActive: 'rgba(63, 185, 80, 0.15)' },
  { value: 'Task', label: 'Task', color: '#58a6ff', bgActive: 'rgba(88, 166, 255, 0.15)' },
  { value: 'Bug', label: 'Bug', color: '#f85149', bgActive: 'rgba(248, 81, 73, 0.15)' },
  { value: 'Feature', label: 'Feature', color: '#d2a8ff', bgActive: 'rgba(210, 168, 255, 0.15)' }
]

export const FIBONACCI_POINTS = [1, 2, 3, 5, 8] as const

export const VEHICLE_OPTIONS = [
  'Platform', 'GWM',

  // DE Series
  'GWM_DE09', 'GWM_DE09-CH', 'GWM_DE09EV', 'GWM_DE09G', 'GWM_DE09B05',
  'GWM_DE09-RWS', 'GWM_DE09SFA', 'GWM_DE09RWA',
  'GWM_DE08', 'GWM_DE08-CH', 'GWM_DE08G',
  'GWM_DE07', 'GWM_DE07-1', 'GWM_DE07-CH',
  'GWM_DE06', 'GWM_DE06-1', 'GWM_DE06-EV', 'GWM_DE06_EV',

  // C Series
  'GWM_C06', 'GWM_C06A', 'GWM_C06_EV', 'GWM_C06A_EV', 'GWM_C01-2',

  // EC Series & Regional Variants
  'GWM_EC15', 'GWM_EC15S', 'GWM_EC15S-EV国内', 'GWM_EC15G', 'GWM_EC15SG',
  'GWM_EC15SG-海外非欧盟EV', 'GWM_EC15SG-欧盟BEV', 'GWM_EC15SG-EV右舵',
  'GWM_EC15S-G-海外非欧盟HEV', 'GWM_EC15S-G-欧盟HEV', 'GWM_EC15SG-HEV-右舵',
  'GWM_EC15S-G-THA', 'GWM_EC15S-1', 'GWM_EC15C', 'GWM_EC15C-G',
  'GWM_EC15W-A', 'GWM_EC15W-G', 'GWM_EC15W-A-G', 'GWM_EC15W-A-G-THA',
  'GWM_EC15GT', 'GWM_EC24', 'GWM_EC24W', 'GWM_EC24-2',

  // A & ES Series
  'GWM_A01-左舵', 'GWM_A02-左舵', 'GWM_A01-右舵', 'GWM_A02-右舵',
  'GWM_ES11-5', 'GWM_ES13', 'GWM_ES11-7',

  // B Series
  'GWM_B01G-THA-1', 'GWM_B01-BRA E27', 'GWM_B01G-3', 'GWM_B01G-4',
  'GWM_B01-BRA E100', 'GWM_B03-BRA E27', 'GWM_B03G-2', 'GWM_B03-BRA E100',
  'GWM_B06-5', 'GWM_B07-1-三合一', 'GWM_B07-1-七合一', 'GWM_B07-3',
  'GWM_B07G-左舵', 'GWM_B07G-右舵', 'GWM_B07EV',
  'GWM_B16-1-三合一', 'GWM_B16-1-七合一',
  'GWM_B26-A', 'GWM_B26-G', 'GWM_B26-1Y-三合一', 'GWM_B26-1Y-七合一',
  'GWM_B26-A-三合一', 'GWM_B26-A-七合一', 'GWM_B26G-一代',
  'GWM_B26G-二代-英国欧盟', 'GWM_B26G-二代-BRA', 'GWM_B26EV',

  // P Series
  'GWM_P01-YQ', 'GWM_P01-2', 'GWM_P01-4', 'GWM_P01G-RHD', 'GWM_P01GP-HEV-BRA',
  'GWM_P02 CUX HI4T Ax', 'GWM_P02 CUX HI4T Fx', 'GWM_P02 CUX HI4Z', 'GWM_P02-3',
  'GWM_P03 CUX HI4T Ax', 'GWM_P03 CUX HI4T Fx', 'GWM_P03 CUX HI4Z',
  'GWM_P03-THA-柴油', 'GWM_P03-2G',
  'GWM_P11-1', 'GWM_P11G-BRA', 'GWM_P13',
  'GWM_P3012-PHEV', 'GWM_P3012G-PHEV', 'GWM_P3012G-BRA-PHEV',
  'GWM_P3012-3-PHEV', 'GWM_P3013-4-PHEV',

  // M Series
  'GWM_M81', 'GWM_M81-26', 'GWM_M82-1', 'GWM_M82_1', 'GWM_M82G', 'GWM_M83-26',

  // Other Platforms
  'GWM_H01', 'GWM_MC01', 'GWM_D07', 'GWM_V71-3',
  'GWM_U2A16', 'GWM_U2A6', 'GWM_EMB 1+4',

  // NIO and PC Series
  'GWM_NIOES8A02', 'GWM_PC003B01', 'GWM_PC002B01',

  // 100FIT / PB Platform Series
  'GWM_100FIT-生产平台', 'GWM_100FIT-项目平台',
  'GWM_100FIT-1.5代PPU平台', 'GWM_100FIT-北汽生产平台',
];

export const PRODUCT_OPTIONS = [
  'EPS', 'IBC', 'IBC1.1', 'iBooster', 'IBC1.2', 'IBC2.0', 'EMB',
  'ERC', 'HEM', 'EDC', 'EAS', 'EDC&EAS', 'ECS',
  'DP-EPS-100fit', 'R-EPS-100fit', 'RWS-100fit', 'SBW-10fit', 'R-EPS-10fit',
  'PB011A01', 'PB012A01', 'SB0042XA1',
]

export const CLASSIFICATION_OPTIONS = [
  // Functional
  'Functional',
  'Non-Functional',

  // Safety — ISO 26262 ASIL levels
  'Safety-QM',
  'Safety-ASIL-A',
  'Safety-ASIL-B',
  'Safety-ASIL-C',
  'Safety-ASIL-D',

  // Constraints & others
  'Constraint',
  'Interface',
  'Performance',
  'Legal/Regulatory',
  'Cybersecurity',
]

export const LAYER_OPTIONS = ['SYS', 'SW', 'APP', 'HW', 'ME', 'TEST', 'SWF']

// Safety fallback only. Edit public/config/components.json or deploy/config/components.json for runtime changes.
// Keyed by project key — each Agile Team gets its own component scope.
export const DEFAULT_COMPONENTS_BY_PROJECT: Record<string, string[]> = {
  // Hardware Team — IC drivers, transceivers, gate/valve drivers
  HW: [
    'TLE9461', 'L9300', 'L9301', 'L9369', 'L9369S', 'FS65', 'FS6523',
    'DRV3245', 'SC900719(BE13)', 'TJA1145',
    'Gate Driver', 'Valve Driver', 'Switch Driver', 'CanTrsv',
    'PWM_Controller',
  ],
  // Software Dev Team — MCAL, BSW, HAbs, system services
  DKKF: [
    'MCAL', 'Wdg', 'Gpt', 'Dma', 'CRC', 'Crypto', 'Mem Driver', 'Eep', 'Mem',
    'Com Drv', 'Eth', 'Spi', 'Lin', 'Fr', 'Uart', 'I2C', 'I/O Drv', 'Port',
    'Adc', 'Pwm', 'Icu', 'Hal',
    'CryIf', 'Dma HAbs', 'Mem HAbs', 'Fee', 'Com HAbs', 'linIf', 'EthIf',
    'FrIf', 'I/O HAbs', 'Adc HAbs', 'Pwm HAbs', 'Icu HAbs', 'Spi HAbs',
    'EcuM', 'BswM', 'WdgM', 'Csm', 'Dem', 'Det', 'Mem Service', 'Com Service',
    'OS_Task', 'Flash_Manager',
    'Boot', 'HSM', 'BM', 'MBM', 'Flash Loader', 'PBL', 'FBL', 'FLD',
    'Complex Sensor Ctrl', 'Complex Com Ctrl', 'Complex Logic Ctrl',
  ],
  // System Team — architecture, integration
  DKKG: ['System', 'SwIntegration', 'ArchDev', 'Calibration', 'CDD_MotCtrl', 'PID_Control'],
  // V&V Team — test-focused; component list typically mirrors the system under test
  DKKFT: ['System', 'MCAL', 'EcuM', 'BswM', 'Dcm', 'CanTp'],
  // EPS Feature Team
  SWSS: ['CDD_MotCtrl', 'PID_Control', 'Calibration'],
  // IBC Feature Team
  SWBS: ['CDD_MotCtrl', 'PID_Control', 'Calibration'],
  // V&V Feature Team
  SWVV: ['System', 'MCAL', 'EcuM', 'BswM', 'Dcm', 'CanTp'],
  // Com&Diag Team — communication and diagnostics stack
  SWCD: [
    'ComM', 'Dcm', 'Nm', 'Xcp', 'CanTp', 'CPD',
    'CAN_Driver', 'LIN_Stack', 'Diag_Module',
  ],
  // Suspension Feature Team
  SWSU: ['CDD_MotCtrl', 'PID_Control', 'Calibration'],
  // Testing & Validation teams
  PMVSS: ['System', 'EcuM', 'BswM', 'Dcm', 'CanTp'],
  PMVBS: ['System', 'EcuM', 'BswM', 'Dcm', 'CanTp'],
  PMVSU: ['System', 'EcuM', 'BswM', 'Dcm', 'CanTp'],
}
