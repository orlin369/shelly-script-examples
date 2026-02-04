/**
 * @title Device State
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/device_state.shelly.js
 */

// ---------- sun2000_device_state ----------
let SUN2000_DEVICE_STATE = [
  {
    name: "Device status",
    units: "",
    reg: { addr: 32089, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Fault code",
    units: "",
    reg: { addr: 32090, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Startup time",
    units: "s",
    reg: { addr: 32091, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Shutdown time",
    units: "s",
    reg: { addr: 32093, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  }
];
