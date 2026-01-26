/**
 * SDS011 Air Quality Sensor - Virtual Components Setup Script
 *
 * Creates the virtual components for SDS011 air quality monitoring UI.
 * Run this script ONCE to set up the graphical interface.
 *
 * Components Created:
 * - Number:200  - PM2.5 value display (ug/m3)
 * - Number:201  - PM10 value display (ug/m3)
 * - Text:200    - AQI category display
 * - Button:200  - Wake/Sleep toggle
 *
 * After running, you can delete this script or disable it.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var COMPONENTS = [
    {
        type: 'number',
        id: 200,
        config: {
            name: 'PM2.5',
            min: 0,
            max: 1000,
            meta: {
                ui: {
                    view: 'label',
                    unit: 'ug/m3',
                    icon: 'mdi:blur'
                }
            }
        }
    },
    {
        type: 'number',
        id: 201,
        config: {
            name: 'PM10',
            min: 0,
            max: 1000,
            meta: {
                ui: {
                    view: 'label',
                    unit: 'ug/m3',
                    icon: 'mdi:blur-linear'
                }
            }
        }
    },
    {
        type: 'text',
        id: 200,
        config: {
            name: 'Air Quality',
            meta: {
                ui: {
                    view: 'label',
                    icon: 'mdi:air-filter'
                }
            }
        }
    },
    {
        type: 'button',
        id: 200,
        config: {
            name: 'SDS011 Wake/Sleep',
            meta: {
                ui: {
                    icon: 'mdi:power'
                }
            }
        }
    }
];

// ============================================================================
// STATE
// ============================================================================

var currentIndex = 0;
var createdCount = 0;
var skippedCount = 0;
var errorCount = 0;

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

function createComponent(comp, callback) {
    var componentKey = comp.type + ':' + comp.id;

    // First check if component already exists
    var status = Shelly.getComponentStatus(comp.type, comp.id);
    if (status !== null) {
        print('[SETUP] Component ' + componentKey + ' already exists, skipping');
        skippedCount++;
        if (callback) callback(true);
        return;
    }

    print('[SETUP] Creating ' + componentKey + ' (' + comp.config.name + ')...');

    Shelly.call(
        'Virtual.Add',
        {
            type: comp.type,
            id: comp.id,
            config: comp.config
        },
        function(result, error_code, error_message) {
            if (error_code !== 0) {
                print('[SETUP] ERROR creating ' + componentKey + ': ' + error_message);
                errorCount++;
                if (callback) callback(false);
            } else {
                print('[SETUP] Created ' + componentKey + ' successfully');
                createdCount++;
                if (callback) callback(true);
            }
        }
    );
}

function createNextComponent() {
    if (currentIndex >= COMPONENTS.length) {
        printSummary();
        return;
    }

    var comp = COMPONENTS[currentIndex];
    currentIndex++;

    createComponent(comp, function(success) {
        // Small delay between component creation
        Timer.set(200, false, createNextComponent);
    });
}

function printSummary() {
    print('');
    print('[SETUP] ========================================');
    print('[SETUP] SDS011 Air Quality Setup Complete');
    print('[SETUP] ----------------------------------------');
    print('[SETUP] Created: ' + createdCount);
    print('[SETUP] Skipped: ' + skippedCount);
    print('[SETUP] Errors:  ' + errorCount);
    print('[SETUP] ========================================');
    print('');

    if (errorCount === 0) {
        print('[SETUP] All components ready!');
        print('');
        print('[SETUP] Virtual Components:');
        print('[SETUP]   number:200 - PM2.5 (ug/m3)');
        print('[SETUP]   number:201 - PM10 (ug/m3)');
        print('[SETUP]   text:200   - AQI category');
        print('[SETUP]   button:200 - Wake/Sleep toggle');
        print('');
        print('[SETUP] You can now run sds011_vc.shelly.js');
        print('[SETUP] This setup script can be disabled or deleted.');
    } else {
        print('[SETUP] Some components failed to create.');
        print('[SETUP] Check errors above and try again.');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    print('');
    print('[SETUP] ========================================');
    print('[SETUP] SDS011 Air Quality - Virtual Components');
    print('[SETUP] ========================================');
    print('[SETUP] Creating ' + COMPONENTS.length + ' virtual components...');
    print('');

    // Start creating components
    createNextComponent();
}

init();
