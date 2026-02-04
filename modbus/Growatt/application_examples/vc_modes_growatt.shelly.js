/**
 * @title Vc Modes Growatt
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/application_examples/vc_modes_growatt.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Growatt solar inverter.
    ENTITIES-based version + Virtual Components.
*/

let ENABLE_MODBUS_LOCAL = 0;
let ENABLE_MODBUS_REMOTE = 1;

// Inverter ID.
let INVERTER_ID = 1;

if (ENABLE_MODBUS_LOCAL){
// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

let ENTRY_OUTPUT_CONFIG = MODBUS_ENDPOINT.addEntity({ addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" });

let ENTRY_CHARGE_CONFIG = MODBUS_ENDPOINT.addEntity({ addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" });
}

if (ENABLE_MODBUS_LOCAL){
}

// 
let output_config_vc = Virtual.getHandle("enum:200");

//
let charge_config_vc = Virtual.getHandle("enum:201");

// 
var output_config_state = 0;

//
var charge_config_state = 0;

function init(){

    // Read information from inverter via modbus.
    if (ENABLE_MODBUS_LOCAL){
        ENTRY_OUTPUT_CONFIG.readOnce();
        output_config_state = ENTRY_OUTPUT_CONFIG.getValue();
        output_config_vc.setValue(output_config_state.toString());
        ENTRY_CHARGE_CONFIG.readOnce();
        charge_config_state = ENTRY_CHARGE_CONFIG.getValue();
    }

    // Read information from inverter via modbus (HTTP).
    if (ENABLE_MODBUS_REMOTE){
        Shelly.call("HTTP.GET",
        {
            url: "http://minhome.net:8060/rpc/MRC.ReadHoldingRegisters?sid="+INVERTER_ID+"&qty=1&addr=1&itype=regtype_holding",
        },
        function(result, error_code, error_message) {
            if (error_code == 0){
                let struct_result = JSON.parse(result.body);
                output_config_state = struct_result.values
                console.log(output_config_state);
                // Populate virtual components.
                output_config_vc.setValue(output_config_state.toString());
            }else{
                console.log("Error code: " + error_code);
                console.log("Error message: " + error_message);
            }
        });
        Shelly.call("HTTP.GET",
        {
            url: "http://minhome.net:8060/rpc/MRC.ReadHoldingRegisters?sid="+INVERTER_ID+"&qty=1&addr=2&itype=regtype_holding",
        },
        function(result, error_code, error_message) {
            if (error_code == 0){
                let struct_result = JSON.parse(result.body);
                charge_config_state = struct_result.values
                console.log(charge_config_state);
                // Populate virtual components.
                charge_config_vc.setValue(charge_config_state.toString());
            }else{
                console.log("Error code: " + error_code);
                console.log("Error message: " + error_message);
            }
        });
    }

    // Event for the output config state.
    output_config_vc.on("change", function(ev){
        output_config_state = ev.value;
        console.log("Output Config: ", output_config_state);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [output_config_state],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
    // Event for the charging config state.
    charge_config_vc.on("change", function(ev){
        charge_config_state = ev.value;
        console.log("Charge Config: ", charge_config_state);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 2, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [charge_config_state],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
}

init();