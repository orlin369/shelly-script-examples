/**
 * @title Get Pv
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_pv.shelly.js
 */

// ---------- sun2000_pv ----------
let SUN2000_PV = [
  { name: "PV1 Voltage", units: "V", reg: { addr: 32016, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "PV1 Current", units: "A", reg: { addr: 32017, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },

  { name: "PV2 Voltage", units: "V", reg: { addr: 32018, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "PV2 Current", units: "A", reg: { addr: 32019, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },

  { name: "PV3 Voltage", units: "V", reg: { addr: 32020, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "PV3 Current", units: "A", reg: { addr: 32021, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },

  { name: "PV4 Voltage", units: "V", reg: { addr: 32022, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "PV4 Current", units: "A", reg: { addr: 32023, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },

  { name: "Input power (total PV)", units: "kW", reg: { addr: 32064, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: "R" }
];
