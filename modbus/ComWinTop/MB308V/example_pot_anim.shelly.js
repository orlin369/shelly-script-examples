/**
 * @title Example Pot Anim
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/example_pot_anim.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicate for communication over MODBUS-RTU with CWT-308V IO module.

    The example combines analog inputs and digital outputs using 2 modbus functions.
*/

// Update rate (sec)
var UPDATE_RATE = 1;

// Get a MODBUS-RTU endpoint: ID 2, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(2, { baud: 9600, mode: "8N1" });

// Add a input register entity at address 0.
// Function code: 0x04
// Evry device have onwn spcification for each register.
// Make sure that you configure register addres, and interpretation properly.
let ENTRY_AI0 = MODBUS_ENDPOINT.addEntity({ addr: 0, rtype: ModbusController.REGTYPE_INPUT, itype: "i16" });

// Create or get a virtual component handle (e.g., for a virtual sensor)
let VC_AI0 = Virtual.getHandle("number:200");

// Digital outputs states array representation.
var DOs = [false, false, false, false,
            false, false, false, false,
            false, false, false, false];

/*
    Run evry UPDATE_RATE seconds.
*/
function update(){
    // Read the entry value.
    ENTRY_AI0.readOnce();
  
    // Get the entry value and convert it to voltage.
    let voltage = (ENTRY_AI0.getValue() / 1100);

    // Update the virtual component with the new value
    VC_AI0.setValue(voltage);

    // Print the voltage to the console.
    console.log("Voltage: " + voltage);

    // Make voltage to int.
    var to_on = parseInt(voltage);

    // Fill DOs with false.
    for (let i = 0; i < DOs.length; i++) {
        DOs[i] = false;
    }

    // Turn on only outputs that represent voltage value.
    for (let i = 0; i < to_on; i++) {
        DOs[i] = true;
    }

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

    Timer.set(parseInt(UPDATE_RATE*1000), true, update);
}

// Run the application.
init();
