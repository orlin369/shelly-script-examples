/**
 * @title Get Grid
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_grid.shelly.js
 */

// ---------- sun2000_grid ----------
let SUN2000_GRID = [
  { name: "Grid voltage L1", units: "V", reg: { addr: 32066, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Grid voltage L2", units: "V", reg: { addr: 32067, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Grid voltage L3", units: "V", reg: { addr: 32068, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },

  { name: "Phase A voltage", units: "V", reg: { addr: 32069, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Phase B voltage", units: "V", reg: { addr: 32070, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Phase C voltage", units: "V", reg: { addr: 32071, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },

  { name: "Grid current L1", units: "A", reg: { addr: 32072, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },
  { name: "Grid current L2", units: "A", reg: { addr: 32074, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },
  { name: "Grid current L3", units: "A", reg: { addr: 32076, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },

  { name: "Peak active power today", units: "kW", reg: { addr: 32078, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },
  { name: "Active power", units: "kW", reg: { addr: 32080, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },

  { name: "Reactive power", units: "kVar", reg: { addr: 32082, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },
  { name: "Power factor", units: "", reg: { addr: 32084, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" },

  { name: "Grid frequency", units: "Hz", reg: { addr: 32085, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Efficiency", units: "%", reg: { addr: 32086, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Internal temperature", units: "°C", reg: { addr: 32087, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Insulation resistance", units: "MΩ", reg: { addr: 32088, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" }
];
