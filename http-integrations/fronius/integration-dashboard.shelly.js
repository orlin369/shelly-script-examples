/**
 * @title Fronius multi-channel energy dashboard
 * @description Polls Fronius Solar API endpoints and updates Shelly Virtual
 *   Components for PV, load, grid, battery, Wattpilot, and ELWA / boiler data.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/fronius/integration-dashboard.shelly.js
 */

/**
 * Reads one or more Fronius JSON endpoints from a local inverter and writes up
 * to 10 pre-created Shelly number Virtual Components.
 *
 * Default Virtual Components:
 * - number:200  Solar Production   W
 * - number:201  House Consumption  W
 * - number:202  Grid Export        W
 * - number:203  Battery SoC        %
 * - number:204  Battery Power      W
 * - number:205  Wattpilot Power    W
 * - number:206  ELWA Power         W
 * - number:207  ELWA Temp 1        degC
 * - number:208  ELWA Temp 2        degC
 * - number:209  Boiler SoC         %
 * - group:200   Fronius Energy     (optional group)
 *
 * Notes:
 * - This script is local-only and assumes pre-created VCs.
 * - Shelly dashboards on this device class practically top out at 10 VCs, so
 *   the requested values are mapped into 10 slots and integrated energy is
 *   printed in logs as kWh.
 * - The core GEN24 fields come from `GetPowerFlowRealtimeData.fcgi`.
 * - Battery SoC / battery power and the Wattpilot / ELWA / boiler channels
 *   differ between Fronius installs. The default lookup arrays include
 *   conservative fallbacks, but you should expect to adjust them per site.
 * - `CONFIG.batteryPositiveMode` defines what a positive Battery Power value
 *   means in the Shelly app and in the integrated kWh counters.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  froniusBaseUrl: 'http://192.168.178.32',
  intervalMs: 5000,
  logEveryPoll: true,
  updateVcMetadata: true,
  batteryPositiveMode: 'charge', // 'charge' or 'discharge'
  sources: {
    powerFlow: {
      enabled: true,
      url: '/solar_api/v1/GetPowerFlowRealtimeData.fcgi',
    },
    storage: {
      enabled: true,
      url: '/solar_api/v1/GetStorageRealtimeData.cgi?Scope=System',
    },
    wattpilot: {
      enabled: false,
      url: '',
    },
    elwa: {
      enabled: false,
      url: '',
    },
  },
};

var SOURCE_KEYS = ['powerFlow', 'storage', 'wattpilot', 'elwa'];

var METRICS = [
  {
    key: 'solarProduction',
    name: 'Solar Production',
    unit: 'W',
    vcId: 'number:200',
    decimals: 0,
    enabled: true,
    energyBucket: 'solarKWh',
    transform: 'nonNegative',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_PV'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '1', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '0', 'P'] },
    ],
    vcHandle: null,
  },
  {
    key: 'houseConsumption',
    name: 'House Consumption',
    unit: 'W',
    vcId: 'number:201',
    decimals: 0,
    enabled: true,
    energyBucket: 'houseKWh',
    transform: 'nonNegative',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_Load'] },
    ],
    vcHandle: null,
  },
  {
    key: 'gridExport',
    name: 'Grid Export',
    unit: 'W',
    vcId: 'number:202',
    decimals: 0,
    enabled: true,
    transform: 'gridExport',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_Grid'] },
    ],
    vcHandle: null,
  },
  {
    key: 'batterySoc',
    name: 'Battery SoC',
    unit: '%',
    vcId: 'number:203',
    decimals: 1,
    enabled: true,
    transform: 'percent',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '1', 'SOC'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Inverters', '0', 'SOC'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'StateOfCharge_Relative'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'StateOfCharge'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'SOC'] },
    ],
    vcHandle: null,
  },
  {
    key: 'batteryPower',
    name: 'Battery Power',
    unit: 'W',
    vcId: 'number:204',
    decimals: 0,
    enabled: true,
    transform: 'batterySigned',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Site', 'P_Akku'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'P'] },
      { source: 'storage', path: ['Body', 'Data', '0', 'Controller', 'Power'] },
    ],
    vcHandle: null,
  },
  {
    key: 'wattpilotPower',
    name: 'Wattpilot Power',
    unit: 'W',
    vcId: 'number:205',
    decimals: 0,
    enabled: true,
    energyBucket: 'wattpilotKWh',
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'SmartLoads', 'Wattpilot', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Smartloads', 'Wattpilot', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'SmartLoads', '1', 'P'] },
      { source: 'wattpilot', path: ['power'] },
      { source: 'wattpilot', path: ['Body', 'Data', 'power'] },
      { source: 'wattpilot', path: ['Body', 'Data', 'Power'] },
    ],
    vcHandle: null,
  },
  {
    key: 'elwaPower',
    name: 'ELWA Power',
    unit: 'W',
    vcId: 'number:206',
    decimals: 0,
    enabled: true,
    energyBucket: 'elwaKWh',
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'P'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Power'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilots', '1', 'P'] },
      { source: 'elwa', path: ['power'] },
      { source: 'elwa', path: ['actualPower'] },
      { source: 'elwa', path: ['Body', 'Data', 'power'] },
    ],
    vcHandle: null,
  },
  {
    key: 'elwaTemp1',
    name: 'ELWA Temp 1',
    unit: 'degC',
    vcId: 'number:207',
    decimals: 1,
    enabled: true,
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temperature1'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temp1'] },
      { source: 'elwa', path: ['temperature1'] },
      { source: 'elwa', path: ['temp1'] },
      { source: 'elwa', path: ['Body', 'Data', 'temperature1'] },
    ],
    vcHandle: null,
  },
  {
    key: 'elwaTemp2',
    name: 'ELWA Temp 2',
    unit: 'degC',
    vcId: 'number:208',
    decimals: 1,
    enabled: true,
    transform: 'identity',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temperature2'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'Temp2'] },
      { source: 'elwa', path: ['temperature2'] },
      { source: 'elwa', path: ['temp2'] },
      { source: 'elwa', path: ['Body', 'Data', 'temperature2'] },
    ],
    vcHandle: null,
  },
  {
    key: 'boilerSoc',
    name: 'Boiler SoC',
    unit: '%',
    vcId: 'number:209',
    decimals: 1,
    enabled: true,
    transform: 'percent',
    lookups: [
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'BoilerSoC'] },
      { source: 'powerFlow', path: ['Body', 'Data', 'Ohmpilot', 'StateOfCharge'] },
      { source: 'elwa', path: ['boilerSoc'] },
      { source: 'elwa', path: ['stateOfCharge'] },
      { source: 'elwa', path: ['Body', 'Data', 'boilerSoc'] },
    ],
    vcHandle: null,
  },
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  lastPollTs: 0,
  pollInFlight: false,
  missingVc: {},
  missingMetric: {},
  sourceErrors: {},
  metadataQueue: [],
  metadataBusy: false,
  metadataIndex: 0,
  energy: {
    solarKWh: 0,
    houseKWh: 0,
    gridImportKWh: 0,
    gridExportKWh: 0,
    batteryChargeKWh: 0,
    batteryDischargeKWh: 0,
    wattpilotKWh: 0,
    elwaKWh: 0,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function toNumber(value) {
  if (isNumber(value)) return value;
  if (typeof value === 'string' && value !== '') {
    value = parseFloat(value);
    if (isNumber(value)) return value;
  }
  return null;
}

function roundValue(value, decimals) {
  var factor;
  if (!isNumber(value)) return value;
  factor = Math.pow(10, decimals || 0);
  return Math.round(value * factor) / factor;
}

function clamp(value, minValue, maxValue) {
  if (!isNumber(value)) return value;
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

function formatPower(value) {
  if (!isNumber(value)) return 'n/a';
  if (Math.abs(value) >= 1000) return roundValue(value / 1000, 2) + ' kW';
  return roundValue(value, 0) + ' W';
}

function formatEnergy(value) {
  if (!isNumber(value)) return '0.000 kWh';
  return roundValue(value, 3) + ' kWh';
}

function capitalize(text) {
  if (!text || !text.length) return text;
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

function parseVcId(vcId) {
  var parts;
  if (!vcId) return null;
  parts = vcId.split(':');
  if (parts.length !== 2) return null;
  return {
    type: parts[0],
    id: parseInt(parts[1], 10),
  };
}

function getPathValue(obj, path) {
  var i;
  var value = obj;
  if (!obj || !path) return null;
  for (i = 0; i < path.length; i++) {
    if (value === null || typeof value === 'undefined') return null;
    value = value[path[i]];
  }
  return value;
}

function getMetricByKey(metricKey) {
  var i;
  for (i = 0; i < METRICS.length; i++) {
    if (METRICS[i].key === metricKey) return METRICS[i];
  }
  return null;
}

function resolveSourceUrl(sourceCfg) {
  if (!sourceCfg || !sourceCfg.url) return null;
  if (sourceCfg.url.indexOf('http://') === 0 || sourceCfg.url.indexOf('https://') === 0) {
    return sourceCfg.url;
  }
  return CONFIG.froniusBaseUrl + sourceCfg.url;
}

function fetchJson(url, callback) {
  Shelly.call('HTTP.GET', { url: url }, function(res, errorCode, errorMessage) {
    var data;

    if (errorCode !== 0) {
      callback('HTTP error [' + errorCode + ']: ' + errorMessage);
      return;
    }

    if (!res || res.code !== 200) {
      callback('Unexpected HTTP response');
      return;
    }

    try {
      data = JSON.parse(res.body);
    } catch (err) {
      callback('JSON parse error: ' + err);
      return;
    }

    callback(null, data);
  });
}

function fetchSources(index, responses, done) {
  var sourceKey;
  var sourceCfg;
  var url;

  if (index >= SOURCE_KEYS.length) {
    done(responses);
    return;
  }

  sourceKey = SOURCE_KEYS[index];
  sourceCfg = CONFIG.sources[sourceKey];

  if (!sourceCfg || !sourceCfg.enabled) {
    fetchSources(index + 1, responses, done);
    return;
  }

  url = resolveSourceUrl(sourceCfg);
  if (!url) {
    fetchSources(index + 1, responses, done);
    return;
  }

  fetchJson(url, function(err, data) {
    if (err) {
      if (!state.sourceErrors[sourceKey]) {
        state.sourceErrors[sourceKey] = true;
        print('[Fronius] ' + sourceKey + ' error: ' + err);
      }
    } else {
      state.sourceErrors[sourceKey] = false;
      responses[sourceKey] = data;
    }
    fetchSources(index + 1, responses, done);
  });
}

function readMetricRawValue(metric, responses) {
  var i;
  var lookup;
  var response;
  var value;
  var numberValue;

  for (i = 0; i < metric.lookups.length; i++) {
    lookup = metric.lookups[i];
    response = responses[lookup.source];
    if (!response) continue;

    value = getPathValue(response, lookup.path);
    numberValue = toNumber(value);
    if (isNumber(numberValue)) return numberValue;
  }

  if (!state.missingMetric[metric.key]) {
    state.missingMetric[metric.key] = true;
    print('[Fronius] No value found for ' + metric.name + '. Review its lookup paths.');
  }
  return null;
}

function transformMetricValue(metric, rawValue) {
  if (!isNumber(rawValue)) return null;

  if (metric.transform === 'nonNegative') {
    return rawValue < 0 ? 0 : rawValue;
  }

  if (metric.transform === 'gridExport') {
    return rawValue < 0 ? Math.abs(rawValue) : 0;
  }

  if (metric.transform === 'percent') {
    return clamp(rawValue, 0, 100);
  }

  if (metric.transform === 'batterySigned') {
    if (CONFIG.batteryPositiveMode === 'discharge') return -rawValue;
    return rawValue;
  }

  return rawValue;
}

function collectSnapshot(responses) {
  var i;
  var metric;
  var rawValue;
  var value;
  var snapshot = {};

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    snapshot[metric.key] = {
      found: false,
      raw: null,
      value: null,
    };

    if (!metric.enabled) continue;

    rawValue = readMetricRawValue(metric, responses);
    if (!isNumber(rawValue)) continue;

    value = transformMetricValue(metric, rawValue);
    if (!isNumber(value)) continue;

    snapshot[metric.key] = {
      found: true,
      raw: rawValue,
      value: roundValue(value, metric.decimals),
    };
  }

  return snapshot;
}

function setVcValue(metric, value) {
  if (!metric.vcHandle) {
    if (!state.missingVc[metric.vcId]) {
      state.missingVc[metric.vcId] = true;
      print('[Fronius] Missing virtual component: ' + metric.vcId);
    }
    return;
  }

  metric.vcHandle.setValue(value);
}

function updateVirtualComponents(snapshot) {
  var i;
  var metric;
  var point;

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    if (!metric.enabled) continue;

    point = snapshot[metric.key];
    if (!point || !point.found) continue;

    setVcValue(metric, point.value);
  }
}

function addEnergy(bucket, powerW, dtSeconds) {
  if (!bucket || !isNumber(powerW) || powerW <= 0 || dtSeconds <= 0) return;
  state.energy[bucket] += (powerW * dtSeconds) / 3600000;
}

function updateIntegratedEnergy(snapshot, dtSeconds) {
  var batteryPoint;

  if (dtSeconds <= 0) return;

  addEnergy('solarKWh', snapshot.solarProduction.value, dtSeconds);
  addEnergy('houseKWh', snapshot.houseConsumption.value, dtSeconds);
  addEnergy('wattpilotKWh', snapshot.wattpilotPower.value, dtSeconds);
  addEnergy('elwaKWh', snapshot.elwaPower.value, dtSeconds);

  if (snapshot.gridExport.found) {
    if (snapshot.gridExport.raw > 0) {
      addEnergy('gridImportKWh', snapshot.gridExport.raw, dtSeconds);
    } else if (snapshot.gridExport.raw < 0) {
      addEnergy('gridExportKWh', Math.abs(snapshot.gridExport.raw), dtSeconds);
    }
  }

  batteryPoint = snapshot.batteryPower;
  if (!batteryPoint.found) return;

  if (CONFIG.batteryPositiveMode === 'charge') {
    if (batteryPoint.value > 0) {
      addEnergy('batteryChargeKWh', batteryPoint.value, dtSeconds);
    } else if (batteryPoint.value < 0) {
      addEnergy('batteryDischargeKWh', Math.abs(batteryPoint.value), dtSeconds);
    }
  } else {
    if (batteryPoint.value > 0) {
      addEnergy('batteryDischargeKWh', batteryPoint.value, dtSeconds);
    } else if (batteryPoint.value < 0) {
      addEnergy('batteryChargeKWh', Math.abs(batteryPoint.value), dtSeconds);
    }
  }
}

function logSnapshot(snapshot) {
  var parts = [];

  if (snapshot.solarProduction.found) parts.push('PV ' + formatPower(snapshot.solarProduction.value));
  if (snapshot.houseConsumption.found) parts.push('Load ' + formatPower(snapshot.houseConsumption.value));
  if (snapshot.gridExport.found) {
    if (snapshot.gridExport.raw > 0) {
      parts.push('Grid In ' + formatPower(snapshot.gridExport.raw));
    } else {
      parts.push('Grid Out ' + formatPower(snapshot.gridExport.value));
    }
  }
  if (snapshot.batterySoc.found) parts.push('Battery SoC ' + roundValue(snapshot.batterySoc.value, 1) + '%');
  if (snapshot.batteryPower.found) parts.push('Battery ' + formatPower(snapshot.batteryPower.value));
  if (snapshot.wattpilotPower.found) parts.push('Wattpilot ' + formatPower(snapshot.wattpilotPower.value));
  if (snapshot.elwaPower.found) parts.push('ELWA ' + formatPower(snapshot.elwaPower.value));
  if (snapshot.elwaTemp1.found) parts.push('T1 ' + roundValue(snapshot.elwaTemp1.value, 1) + ' degC');
  if (snapshot.elwaTemp2.found) parts.push('T2 ' + roundValue(snapshot.elwaTemp2.value, 1) + ' degC');
  if (snapshot.boilerSoc.found) parts.push('Boiler ' + roundValue(snapshot.boilerSoc.value, 1) + '%');

  parts.push(
    'Energy PV=' + formatEnergy(state.energy.solarKWh) +
      ' Load=' + formatEnergy(state.energy.houseKWh) +
      ' GridIn=' + formatEnergy(state.energy.gridImportKWh) +
      ' GridOut=' + formatEnergy(state.energy.gridExportKWh) +
      ' BattIn=' + formatEnergy(state.energy.batteryChargeKWh) +
      ' BattOut=' + formatEnergy(state.energy.batteryDischargeKWh) +
      ' WP=' + formatEnergy(state.energy.wattpilotKWh) +
      ' ELWA=' + formatEnergy(state.energy.elwaKWh)
  );

  print('[Fronius] ' + parts.join(' | '));
}

function configureMetricVc(metric) {
  var parsed;
  var config;

  if (!metric.vcId || !CONFIG.updateVcMetadata) return;

  parsed = parseVcId(metric.vcId);
  if (!parsed || parsed.type !== 'number') return;

  config = Shelly.getComponentConfig(parsed.type, parsed.id);
  if (!config) return;

  if (!config.meta) config.meta = {};
  if (!config.meta.ui) config.meta.ui = {};

  config.name = metric.name;
  config.meta.ui.unit = metric.unit;
  config.meta.ui.view = 'label';

  state.metadataQueue.push({
    method: 'Number.SetConfig',
    params: { id: parsed.id, config: config },
    vcId: metric.vcId,
    unit: metric.unit,
  });
}

function processMetadataQueue() {
  var job;

  if (state.metadataBusy || state.metadataIndex >= state.metadataQueue.length) return;

  job = state.metadataQueue[state.metadataIndex];
  state.metadataIndex++;
  state.metadataBusy = true;

  Shelly.call(job.method, job.params, function(result, errorCode, errorMessage) {
    if (errorCode !== 0) {
      print('[Fronius] VC config error for ' + job.vcId + ': ' + errorMessage);
    }
    state.metadataBusy = false;
    Timer.set(50, false, processMetadataQueue);
  });
}

function initVcHandles() {
  var i;
  var metric;

  for (i = 0; i < METRICS.length; i++) {
    metric = METRICS[i];
    if (!metric.enabled || !metric.vcId) continue;
    metric.vcHandle = Virtual.getHandle(metric.vcId);
    configureMetricVc(metric);
  }

  processMetadataQueue();
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  var now = Date.now();
  var dtSeconds;

  if (state.pollInFlight) {
    print('[Fronius] Poll skipped: previous cycle still in progress');
    return;
  }

  state.pollInFlight = true;

  fetchSources(0, {}, function(responses) {
    var snapshot;

    dtSeconds = 0;
    if (state.lastPollTs > 0) {
      dtSeconds = (now - state.lastPollTs) / 1000;
    }
    state.lastPollTs = now;

    snapshot = collectSnapshot(responses);
    updateIntegratedEnergy(snapshot, dtSeconds);
    updateVirtualComponents(snapshot);

    if (CONFIG.logEveryPoll) logSnapshot(snapshot);

    state.pollInFlight = false;
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

print('[Fronius] Multi-channel energy dashboard');
print('[Fronius] Battery positive mode: ' + CONFIG.batteryPositiveMode);
print('[Fronius] Local-only variant. Adjust lookup paths for Wattpilot / ELWA per site.');

initVcHandles();
Timer.set(CONFIG.intervalMs, true, poll);
poll();
