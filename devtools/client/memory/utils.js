/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cu, Cc, Ci } = require("chrome");

const { LocalizationHelper } = require("devtools/client/shared/l10n");
const STRINGS_URI = "chrome://devtools/locale/memory.properties"
const L10N = exports.L10N = new LocalizationHelper(STRINGS_URI);

const { OS } = require("resource://gre/modules/osfile.jsm");
const { assert } = require("devtools/shared/DevToolsUtils");
const { Preferences } = require("resource://gre/modules/Preferences.jsm");
const CUSTOM_CENSUS_DISPLAY_PREF = "devtools.memory.custom-census-displays";
const CUSTOM_DOMINATOR_TREE_DISPLAY_PREF = "devtools.memory.custom-dominator-tree-displays";
const DevToolsUtils = require("devtools/shared/DevToolsUtils");
const {
  snapshotState: states,
  diffingState,
  censusDisplays,
  dominatorTreeDisplays,
  dominatorTreeState
} = require("./constants");

/**
 * Takes a snapshot object and returns the localized form of its timestamp to be
 * used as a title.
 *
 * @param {Snapshot} snapshot
 * @return {String}
 */
exports.getSnapshotTitle = function (snapshot) {
  if (!snapshot.creationTime) {
    return L10N.getStr("snapshot-title.loading");
  }

  if (snapshot.imported) {
    // Strip out the extension if it's the expected ".fxsnapshot"
    return OS.Path.basename(snapshot.path.replace(/\.fxsnapshot$/, ""));
  }

  let date = new Date(snapshot.creationTime / 1000);
  return date.toLocaleTimeString(void 0, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  });
};

function getCustomDisplaysHelper(pref) {
  let customDisplays = Object.create(null);
  try {
    customDisplays = JSON.parse(Preferences.get(pref)) || Object.create(null);
  } catch (e) {
    DevToolsUtils.reportException(
      `String stored in "${pref}" pref cannot be parsed by \`JSON.parse()\`.`);
  }
  return Object.freeze(customDisplays);
}

/**
 * Returns custom displays defined in `devtools.memory.custom-census-displays`
 * pref.
 *
 * @return {Object}
 */
exports.getCustomCensusDisplays = function () {
  return getCustomDisplaysHelper(CUSTOM_CENSUS_DISPLAY_PREF);
};

/**
 * Returns custom displays defined in
 * `devtools.memory.custom-dominator-tree-displays` pref.
 *
 * @return {Object}
 */
exports.getCustomDominatorTreeDisplays = function () {
  return getCustomDisplaysHelper(CUSTOM_DOMINATOR_TREE_DISPLAY_PREF);
};

/**
 * Returns a string representing a readable form of the snapshot's state. More
 * concise than `getStatusTextFull`.
 *
 * @param {snapshotState | diffingState} state
 * @return {String}
 */
exports.getStatusText = function (state) {
  assert(state, "Must have a state");

  switch (state) {
    case diffingState.ERROR:
      return L10N.getStr("diffing.state.error");

    case states.ERROR:
      return L10N.getStr("snapshot.state.error");

    case states.SAVING:
      return L10N.getStr("snapshot.state.saving");

    case states.IMPORTING:
      return L10N.getStr("snapshot.state.importing");

    case states.SAVED:
    case states.READING:
      return L10N.getStr("snapshot.state.reading");

    case states.SAVING_CENSUS:
      return L10N.getStr("snapshot.state.saving-census");

    case diffingState.TAKING_DIFF:
      return L10N.getStr("diffing.state.taking-diff");

    case diffingState.SELECTING:
      return L10N.getStr("diffing.state.selecting");

    case dominatorTreeState.COMPUTING:
      return L10N.getStr("dominatorTree.state.computing");

    case dominatorTreeState.COMPUTED:
    case dominatorTreeState.FETCHING:
      return L10N.getStr("dominatorTree.state.fetching");

    case dominatorTreeState.INCREMENTAL_FETCHING:
      return L10N.getStr("dominatorTree.state.incrementalFetching");

    case dominatorTreeState.ERROR:
      return L10N.getStr("dominatorTree.state.error");

    // These states do not have any message to show as other content will be
    // displayed.
    case dominatorTreeState.LOADED:
    case diffingState.TOOK_DIFF:
    case states.READ:
    case states.SAVED_CENSUS:
      return "";

    default:
      assert(false, `Unexpected state: ${state}`);
      return "";
  }
};

/**
 * Returns a string representing a readable form of the snapshot's state;
 * more verbose than `getStatusText`.
 *
 * @param {snapshotState | diffingState} state
 * @return {String}
 */
exports.getStatusTextFull = function (state) {
  assert(!!state, "Must have a state");

  switch (state) {
    case diffingState.ERROR:
      return L10N.getStr("diffing.state.error.full");

    case states.ERROR:
      return L10N.getStr("snapshot.state.error.full");

    case states.SAVING:
      return L10N.getStr("snapshot.state.saving.full");

    case states.IMPORTING:
      return L10N.getStr("snapshot.state.importing");

    case states.SAVED:
    case states.READING:
      return L10N.getStr("snapshot.state.reading.full");

    case states.SAVING_CENSUS:
      return L10N.getStr("snapshot.state.saving-census.full");

    case diffingState.TAKING_DIFF:
      return L10N.getStr("diffing.state.taking-diff.full");

    case diffingState.SELECTING:
      return L10N.getStr("diffing.state.selecting.full");

    case dominatorTreeState.COMPUTING:
      return L10N.getStr("dominatorTree.state.computing.full");

    case dominatorTreeState.COMPUTED:
    case dominatorTreeState.FETCHING:
      return L10N.getStr("dominatorTree.state.fetching.full");

    case dominatorTreeState.INCREMENTAL_FETCHING:
      return L10N.getStr("dominatorTree.state.incrementalFetching.full");

    case dominatorTreeState.ERROR:
      return L10N.getStr("dominatorTree.state.error.full");

    // These states do not have any full message to show as other content will
    // be displayed.
    case dominatorTreeState.LOADED:
    case diffingState.TOOK_DIFF:
    case states.READ:
    case states.SAVED_CENSUS:
      return "";

    default:
      assert(false, `Unexpected state: ${state}`);
      return "";
  }
};

/**
 * Return true if the snapshot is in a diffable state, false otherwise.
 *
 * @param {snapshotModel} snapshot
 * @returns {Boolean}
 */
exports.snapshotIsDiffable = function snapshotIsDiffable(snapshot) {
  return snapshot.state === states.SAVED_CENSUS
    || snapshot.state === states.SAVING_CENSUS
    || snapshot.state === states.SAVED
    || snapshot.state === states.READ;
};

/**
 * Takes an array of snapshots and a snapshot and returns
 * the snapshot instance in `snapshots` that matches
 * the snapshot passed in.
 *
 * @param {appModel} state
 * @param {snapshotId} id
 * @return {snapshotModel|null}
 */
exports.getSnapshot = function getSnapshot (state, id) {
  const found = state.snapshots.find(s => s.id === id);
  assert(found, `No matching snapshot found with id = ${id}`);
  return found;
};

/**
 * Creates a new snapshot object.
 *
 * @param {appModel} state
 * @return {Snapshot}
 */
let ID_COUNTER = 0;
exports.createSnapshot = function createSnapshot(state) {
  let dominatorTree = null;
  if (state.view === dominatorTreeState.DOMINATOR_TREE) {
    dominatorTree = Object.freeze({
      dominatorTreeId: null,
      root: null,
      error: null,
      state: dominatorTreeState.COMPUTING,
    });
  }

  return Object.freeze({
    id: ++ID_COUNTER,
    state: states.SAVING,
    dominatorTree,
    census: null,
    path: null,
    imported: false,
    selected: false,
    error: null,
  });
};

/**
 * Return true if the census is up to date with regards to the current filtering
 * and requested display, false otherwise.
 *
 * @param {String} filter
 * @param {censusDisplayModel} display
 * @param {censusModel} census
 *
 * @returns {Boolean}
 */
exports.censusIsUpToDate = function (filter, display, census) {
  return census
      && filter === census.filter
      && display === census.display;
};

/**
 * Returns true if the given snapshot's dominator tree has been computed, false
 * otherwise.
 *
 * @param {SnapshotModel} snapshot
 * @returns {Boolean}
 */
exports.dominatorTreeIsComputed = function (snapshot) {
  return snapshot.dominatorTree &&
    (snapshot.dominatorTree.state === dominatorTreeState.COMPUTED ||
     snapshot.dominatorTree.state === dominatorTreeState.LOADED ||
     snapshot.dominatorTree.state === dominatorTreeState.INCREMENTAL_FETCHING);
};

/**
 * Takes a snapshot and returns the total bytes and total count that this
 * snapshot represents.
 *
 * @param {CensusModel} census
 * @return {Object}
 */
exports.getSnapshotTotals = function (census) {
  let bytes = 0;
  let count = 0;

  let report = census.report;
  if (report) {
    bytes = report.totalBytes;
    count = report.totalCount;
  }

  return { bytes, count };
};

/**
 * Takes some configurations and opens up a file picker and returns
 * a promise to the chosen file if successful.
 *
 * @param {String} .title
 *        The title displayed in the file picker window.
 * @param {Array<Array<String>>} .filters
 *        An array of filters to display in the file picker. Each filter in the array
 *        is a duple of two strings, one a name for the filter, and one the filter itself
 *        (like "*.json").
 * @param {String} .defaultName
 *        The default name chosen by the file picker window.
 * @param {String} .mode
 *        The mode that this filepicker should open in. Can be "open" or "save".
 * @return {Promise<?nsILocalFile>}
 *        The file selected by the user, or null, if cancelled.
 */
exports.openFilePicker = function({ title, filters, defaultName, mode }) {
  mode = mode === "save" ? Ci.nsIFilePicker.modeSave :
         mode === "open" ? Ci.nsIFilePicker.modeOpen : null;

  if (mode == void 0) {
    throw new Error("No valid mode specified for nsIFilePicker.");
  }

  let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(window, title, mode);

  for (let filter of (filters || [])) {
    fp.appendFilter(filter[0], filter[1]);
  }
  fp.defaultString = defaultName;

  return new Promise(resolve => {
    fp.open({
      done: result => {
        if (result === Ci.nsIFilePicker.returnCancel) {
          resolve(null);
          return;
        }
        resolve(fp.file);
      }
    });
  });
};

/**
 * Format the provided number with a space every 3 digits, and optionally
 * prefixed by its sign.
 *
 * @param {Number} number
 * @param {Boolean} showSign (defaults to false)
 */
exports.formatNumber = function(number, showSign = false) {
  const rounded = Math.round(number);
  if (rounded === 0 || rounded === -0) {
    return "0";
  }

  const abs = String(Math.abs(rounded));
  // replace every digit followed by (sets of 3 digits) by (itself and a space)
  const formatted = abs.replace(/(\d)(?=(\d{3})+$)/g, "$1 ");

  if (showSign) {
    const sign = rounded < 0 ? "-" : "+";
    return sign + formatted;
  }
  return formatted;
};

/**
 * Format the provided percentage following the same logic as formatNumber and
 * an additional % suffix.
 *
 * @param {Number} percent
 * @param {Boolean} showSign (defaults to false)
 */
exports.formatPercent = function(percent, showSign = false) {
  return exports.L10N.getFormatStr("tree-item.percent",
                           exports.formatNumber(percent, showSign));
};
