/**
 * @title Vc Modes Deye
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/vc_modes_deye.shelly.js
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
}

if (ENABLE_MODBUS_LOCAL){
}

// 
let battery_priority_mode_vc = Virtual.getHandle("enum:202");

//
let passive_grid_connected_power_balancing_vc = Virtual.getHandle("enum:203");

//
let active_grid_connected_power_balancing_vc = Virtual.getHandle("enum:204");

// 
var battery_priority_mode = 0;

//
var passive_grid_connected_power_balancing = 0;

//
var active_grid_connected_power_balancing = 0;

//
var energy_management_model = 0;

function init(){

    // Read information from inverter via modbus.
    if (ENABLE_MODBUS_LOCAL){
        ENTRY_OUTPUT_CONFIG.readOnce();
        output_config_state = ENTRY_OUTPUT_CONFIG.getValue();
        output_config_vc.setValue(output_config_state.toString());
    }

    // Read information from inverter via modbus (HTTP).
    if (ENABLE_MODBUS_REMOTE){
        Shelly.call("HTTP.GET",
        {
            url: "http://10.101.3.140/rpc/MRC.ReadHoldingRegisters?sid="+INVERTER_ID+"&qty=1&addr=141&itype=regtype_holding",
        },
        function(result, error_code, error_message) {
            if (error_code == 0){
                let struct_result = JSON.parse(result.body);
                energy_management_model = struct_result.values
                console.log(energy_management_model);
                // Populate virtual components.
                // output_config_vc.setValue(output_config_state.toString());
            }else{
                console.log("Error code: " + error_code);
                console.log("Error message: " + error_message);
            }
        });
    }

    // Battery Priority Mode
    battery_priority_mode_vc.on("change", function(ev){
        battery_priority_mode = ev.value;
        console.log("Output Config: ", battery_priority_mode);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [battery_priority_mode],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
    // Passive Grid-Connected Power Balancing
    passive_grid_connected_power_balancing_vc.on("change", function(ev){
        passive_grid_connected_power_balancing = ev.value;
        console.log("Charge Config: ", passive_grid_connected_power_balancing);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 2, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [passive_grid_connected_power_balancing],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
    // Active Grid-Connected Power Balancing Not on / closed
    active_grid_connected_power_balancing_vc.on("change", function(ev){
        active_grid_connected_power_balancing = ev.value;
        console.log("Charge Config: ", active_grid_connected_power_balancing);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 2, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [active_grid_connected_power_balancing],
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