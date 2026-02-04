/**
 * @title Example Discrete Outputs
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/example_discrete_outputs.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicate for communication over MODBUS-RTU with CWT-308V IO module.

    - Create virtual component named AI0.
    Range 0 - 10, MU [V], step 0.01, progress bar.
    - Add it to group named CWT308V
    - Create new script and paste the following code in the script text field.
    - Run the script.
*/

// Update rate (sec)
var UPDATE_RATE = 1;

// Get a MODBUS-RTU endpoint: ID 2, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(2, { baud: 9600, mode: "8N1" });

var FLAG_STATE = false;

var DOs = [FLAG_STATE, FLAG_STATE, FLAG_STATE, FLAG_STATE,
            FLAG_STATE, FLAG_STATE, FLAG_STATE, FLAG_STATE,
            FLAG_STATE, FLAG_STATE, FLAG_STATE, FLAG_STATE];

// Create or get a virtual component handle (e.g., for a virtual sensor)
//let VC_AI0 = Virtual.getHandle("number:200");

/*
    Run evry UPDATE_RATE seconds.
*/
function update(){
    // Flip the bit state.
    // Animation.
    FLAG_STATE = !FLAG_STATE;

    // Digital Outputs.
    DOs = [FLAG_STATE, !FLAG_STATE, FLAG_STATE, !FLAG_STATE,
            FLAG_STATE, !FLAG_STATE, FLAG_STATE, !FLAG_STATE,
            FLAG_STATE, !FLAG_STATE, FLAG_STATE, !FLAG_STATE];

    // Print states.
    console.log("DOs States: " + DOs);

    // Function code: 0x01
    MODBUS_ENDPOINT.writeRegisters(
        { addr: 0, rtype: ModbusController.REGTYPE_COIL, itype: "i16" },
        DOs,
        function (success, error) {
            if (!success)
            {
                console.log("Success: " + success);
                console.log("Error: " + error);
            }
        });
}

/*
    Runs once at script start time.
*/
function init(){

    Timer.set(UPDATE_RATE*1000, true, update);
}

// Run the application.
init();