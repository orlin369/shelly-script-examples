/**
 * @title Get Energy
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_energy.shelly.js
 */

// ---------- sun2000_energy ----------
let SUN2000_ENERGY = [
  {
    name: "Total energy yield",
    units: "kWh",
    reg: { addr: 32106, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01, rights: "R"
  },
  {
    name: "Daily energy yield",
    units: "kWh",
    reg: { addr: 32114, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01, rights: "R"
  }
];
