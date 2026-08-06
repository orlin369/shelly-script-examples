/**
 * @title MarsRock G2 SUN Series Grid-Tie Inverter - MODBUS-RTU reader
 * @description Reads AC output power, grid voltage, DC input voltage, and
 *   temperature from a MarsRock G2 (Generation 2) SUN Series grid-tie
 *   micro-inverter over MODBUS-RTU and prints values to the console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/MarsRock/G2_SUN_Series_Grid_Tie_Inverter/get_live_status.shelly.js
 */

/**
 * MarsRock G2 (Generation 2) SUN Series Grid-Tie Micro-Inverter
 * MODBUS-RTU Reader
 *
 * Communication parameters (factory defaults):
 *   Slave ID  : 1  (configurable 1–16 via jumpers J1–J4 on the RS485 module)
 *   Baud rate : 9600
 *   Mode      : 8N1
 *
 * Register map (FC 0x03 – Read Holding Registers):
 *
 *   Addr  Name                  Type    Scale  Unit   Access  Notes
 *   ----  --------------------  ------  -----  -----  ------  ----------------------
 *   0x00  AC Power Setpoint     UINT16  ×10    W      W       Set inverter output power
 *   0x01  AC Output Power       UINT16  ×10    W      R       Displayed AC output power
 *   0x02  Grid Voltage          UINT16  ×10    V      R       Grid (AC) voltage
 *   0x03  DC Input Voltage      UINT16  ×10    V      R       Solar panel / DC bus voltage
 *   0x04  DAC Value             UINT16  raw    -      R/W     Analog control output (0–33187)
 *   0x05  Calibration Control   UINT16  -      -      W       Write 0x01 to start calibration
 *   0x06  AC Power Mirror       UINT16  ×10    W      R       Mirror of register 0x00 (FW ≥ 1.06)
 *   0x07  Temperature           UINT16  1      °C     R       Inverter temperature (FW ≥ 1.06)
 *
 * Example frame (read AC output power, register 0x01, slave 0x01):
 *   TX: 01 03 00 01 00 01 D5 CA
 *   RX: 01 03 02 03 E8 xx xx  -> 0x03E8 = 1000 → 100.0 W
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  --- B (D-)   --> Inverter RS485 B
 *   IO2 (RX)  --- A (D+)   --> Inverter RS485 A
 *   IO3       --- DE/RE        direction control (automatic)
 *   GND       --- GND      --> Inverter GND
 *
 * Reference:
 *   https://marsrock.com.cn/u_file/2405/09/file/G2SeriesMicroinverterSolarUserManual.pdf
 *   https://github.com/trucki-eu/RS485-Interface-for-Sun-GTIL2-1000
 */

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// Inverter (AC Output) register map
let ENTITIES_INVERTER = [
    { key: "AC_OUTPUT_POWER",   name: "AC Output Power",   units: "W",  reg: { addr: 0x01, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.LE, wo: ModbusController.BE }, scale: 0.1, rights: "R", vcId: null, handle: null, vcHandle: null },
    { key: "AC_GRID_VOLTAGE",   name: "AC Grid Voltage",   units: "V",  reg: { addr: 70, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R", vcId: null, handle: null, vcHandle: null },
    { key: "DC_INPUT_VOLTAGE",  name: "DC Input Voltage",  units: "V",  reg: { addr: 109, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R", vcId: null, handle: null, vcHandle: null },
    { key: "DAC_VALUE",         name: "DAC Value",         units: "-",  reg: { addr: 0x04, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { key: "TEMPERATURE",       name: "Temperature",       units: "C",  reg: { addr: 63, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, offset: 2, rights: "R", vcId: null, handle: null, vcHandle: null },
];


// Registers all MODBUS entities from ENTITIES_INVERTER[].
function registerEntities(endpoint, entities) {
  for (let i = 0; i < entities.length; i++) {
    entities[i]["entity"] = endpoint.addEntity(entities[i].reg);
  }
}

/*
    Polling update
*/
function update() {
  var value = 0;
  for (var name in ENTITIES_INVERTER) {
    value = ENTITIES_INVERTER[name].entity.getValue() * ENTITIES_INVERTER[name].scale;
    if (ENTITIES_INVERTER[name].offset !== undefined) {
      value += ENTITIES_INVERTER[name].offset;
    }
    console.log(ENTITIES_INVERTER[name].name + ": " +
    value +
    "[" + ENTITIES_INVERTER[name].units + "]");
  }
}

/*
    Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_INVERTER);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Start the application
init();
