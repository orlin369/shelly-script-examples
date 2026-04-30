/**
 * @title Fronius grid flow integration
 * @description Polls the Fronius Solar API and updates Virtual Components with
 *   grid import/export power and accumulated energy values.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/fronius/integration.shelly.js
 */

/**
 * Reads `GetPowerFlowRealtimeData.fcgi` from a local Fronius inverter and
 * writes the result into pre-created Shelly number Virtual Components.
 *
 * Virtual Components used:
 * - number:200 Grid import power in W
 * - number:201 Grid export power in W
 * - number:202 Grid import energy in kWh
 * - number:203 Grid export energy in kWh
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  froniusIp: '192.168.178.32',
  intervalMs: 5000,
  vc: {
    gridImportW: 'number:200',
    gridExportW: 'number:201',
    gridImportKWh: 'number:202',
    gridExportKWh: 'number:203',
  },
};

// ============================================================================
// STATE
// ============================================================================

let state = {
  lastTs: Date.now(),
  importKWh: 0,
  exportKWh: 0,
  missingVc: {},
};

let vc = {
  gridImportW: Virtual.getHandle(CONFIG.vc.gridImportW),
  gridExportW: Virtual.getHandle(CONFIG.vc.gridExportW),
  gridImportKWh: Virtual.getHandle(CONFIG.vc.gridImportKWh),
  gridExportKWh: Virtual.getHandle(CONFIG.vc.gridExportKWh),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function setVcValue(handle, key, value) {
  if (!handle) {
    if (!state.missingVc[key]) {
      state.missingVc[key] = true;
      print('Missing virtual component: ' + key);
    }
    return;
  }

  handle.setValue(value);
}

function updateVirtualComponents(importW, exportW) {
  setVcValue(vc.gridImportW, CONFIG.vc.gridImportW, importW);
  setVcValue(vc.gridExportW, CONFIG.vc.gridExportW, exportW);
  setVcValue(vc.gridImportKWh, CONFIG.vc.gridImportKWh, state.importKWh);
  setVcValue(vc.gridExportKWh, CONFIG.vc.gridExportKWh, state.exportKWh);
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function update() {
  let url = 'http://' + CONFIG.froniusIp + '/solar_api/v1/GetPowerFlowRealtimeData.fcgi';

  Shelly.call('HTTP.GET', { url: url }, function(res, errorCode, errorMessage) {
    let now;
    let dt;
    let data;
    let pGrid;
    let importW;
    let exportW;

    if (errorCode !== 0) {
      print('HTTP error [' + errorCode + ']: ' + errorMessage);
      return;
    }

    if (!res || res.code !== 200) {
      print('Unexpected HTTP response');
      return;
    }

    try {
      data = JSON.parse(res.body);
      pGrid = data.Body.Data.Site.P_Grid;
    } catch (err) {
      print('JSON parse error: ' + err);
      return;
    }

    if (typeof pGrid !== 'number') {
      print('Missing Site.P_Grid in Fronius response');
      return;
    }

    now = Date.now();
    dt = (now - state.lastTs) / 1000;
    state.lastTs = now;

    importW = 0;
    exportW = 0;

    if (pGrid > 0) {
      importW = pGrid;
      state.importKWh += (importW * dt) / 3600000;
    } else if (pGrid < 0) {
      exportW = Math.abs(pGrid);
      state.exportKWh += (exportW * dt) / 3600000;
    }

    updateVirtualComponents(importW, exportW);
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

Timer.set(CONFIG.intervalMs, true, update);
update();
