/**
 * @title Diagnostic Register Scan
 * @description One-shot register scan utility for discovering unknown register values on this device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/MarsRock/G2_SUN_Series_Grid_Tie_Inverter/diagnostic_register_scan.shelly.js
 */

/*
    One-shot MarsRock G2 register diagnostic.
    Scans holding and input registers for temperature candidates near 26.0 C.
*/

let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: "8N1" });

function swap16(v) {
  return ((v & 0xff) << 8) | ((v >> 8) & 0xff);
}

function toHex(v) {
  let s = (v >>> 0).toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return "0x" + s;
}

function scanRange(label, rtype, start, qty, done) {
  MODBUS_ENDPOINT.readRegisters({
    rtype: rtype,
    addr: start,
    qty: qty
  }, function (result, error) {
    if (error) {
      let msg = (typeof error === "object" && error !== null && error.message) ? error.message : "" + error;
      let code = (typeof error === "object" && error !== null && error.code !== undefined) ? error.code : "";
      console.log(label + " error @" + start + " code=" + code + " msg=" + msg);
      done();
      return;
    }

    let parts = [];
    for (let i = 0; i < result.length; i++) {
      let addr = start + i;
      let raw = result[i];
      let swapped = swap16(raw);
      let text =
        "r" + addr +
        "=" + raw +
        "/" + toHex(raw) +
        "/s" + swapped +
        "/x0.1:" + (raw * 0.1) +
        "/x0.01:" + (raw * 0.01) +
        "/sx0.1:" + (swapped * 0.1) +
        "/sx0.01:" + (swapped * 0.01);
      if (
        raw === 26 || swapped === 26 ||
        raw === 260 || swapped === 260 ||
        raw === 2600 || swapped === 2600 ||
        (raw >= 20 && raw <= 35) || (swapped >= 20 && swapped <= 35) ||
        (raw >= 200 && raw <= 350) || (swapped >= 200 && swapped <= 350)
      ) {
        parts.push(text);
      }
    }

    if (parts.length) console.log(label + " " + parts.join(" | "));
    done();
  });
}

Timer.set(1200, false, function () {
  scanRange("HT0", ModbusController.REGTYPE_HOLDING, 0, 64, function () {
    scanRange("HT64", ModbusController.REGTYPE_HOLDING, 64, 64, function () {
      scanRange("HT128", ModbusController.REGTYPE_HOLDING, 128, 64, function () {
        scanRange("IT0", ModbusController.REGTYPE_INPUT, 0, 64, function () {
          scanRange("IT64", ModbusController.REGTYPE_INPUT, 64, 64, function () {
            scanRange("IT128", ModbusController.REGTYPE_INPUT, 128, 64, function () {
              console.log("diag done");
            });
          });
        });
      });
    });
  });
});
