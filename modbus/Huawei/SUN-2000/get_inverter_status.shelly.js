/**
 * @title Get Inverter Status
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Huawei/SUN-2000/get_inverter_status.shelly.js
 */

// ---------- sun2000_status ----------
let SUN2000_STATUS = [
  {
    name: "Running status (remote communication)",
    units: "",
    reg: { addr: 32000, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Running status (monitoring processing)",
    units: "",
    reg: { addr: 32002, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Running status (power processing)",
    units: "",
    reg: { addr: 32003, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Alarm 1",
    units: "",
    reg: { addr: 32008, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Alarm 2",
    units: "",
    reg: { addr: 32010, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  },
  {
    name: "Alarm 3",
    units: "",
    reg: { addr: 32012, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1, rights: "R"
  }
];
