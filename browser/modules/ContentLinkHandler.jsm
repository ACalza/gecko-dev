/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

this.EXPORTED_SYMBOLS = [ "ContentLinkHandler" ];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Feeds",
  "resource:///modules/Feeds.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "BrowserUtils",
  "resource://gre/modules/BrowserUtils.jsm");

const SIZES_TELEMETRY_ENUM = {
  NO_SIZES: 0,
  ANY: 1,
  DIMENSION: 2,
  INVALID: 3,
};

this.ContentLinkHandler = {
  init: function(chromeGlobal) {
    chromeGlobal.addEventListener("DOMLinkAdded", (event) => {
      this.onLinkEvent(event, chromeGlobal);
    }, false);
    chromeGlobal.addEventListener("DOMLinkChanged", (event) => {
      this.onLinkEvent(event, chromeGlobal);
    }, false);
  },

  onLinkEvent: function(event, chromeGlobal) {
    var link = event.originalTarget;
    var rel = link.rel && link.rel.toLowerCase();
    if (!link || !link.ownerDocument || !rel || !link.href)
      return;

    // Ignore sub-frames (bugs 305472, 479408).
    let window = link.ownerDocument.defaultView;
    if (window != window.top)
      return;

    var feedAdded = false;
    var iconAdded = false;
    var searchAdded = false;
    var rels = {};
    for (let relString of rel.split(/\s+/))
      rels[relString] = true;

    for (let relVal in rels) {
      switch (relVal) {
        case "feed":
        case "alternate":
          if (!feedAdded && event.type == "DOMLinkAdded") {
            if (!rels.feed && rels.alternate && rels.stylesheet)
              break;

            if (Feeds.isValidFeed(link, link.ownerDocument.nodePrincipal, "feed" in rels)) {
              chromeGlobal.sendAsyncMessage("Link:AddFeed",
                                            {type: link.type,
                                             href: link.href,
                                             title: link.title});
              feedAdded = true;
            }
          }
          break;
        case "icon":
          if (iconAdded || !Services.prefs.getBoolPref("browser.chrome.site_icons"))
            break;

          var uri = this.getLinkIconURI(link);
          if (!uri)
            break;

          // Telemetry probes for measuring the sizes attribute
          // usage and available dimensions.
          let sizeHistogramTypes = Services.telemetry.
                                   getHistogramById("LINK_ICON_SIZES_ATTR_USAGE");
          let sizeHistogramDimension = Services.telemetry.
                                       getHistogramById("LINK_ICON_SIZES_ATTR_DIMENSION");
          let sizesType;
          if (link.sizes.length) {
            for (let size of link.sizes) {
              if (size.toLowerCase() == "any") {
                sizesType = SIZES_TELEMETRY_ENUM.ANY;
                break;
              } else {
                let re = /^([1-9][0-9]*)x[1-9][0-9]*$/i;
                let values = re.exec(size);
                if (values && values.length > 1) {
                  sizesType = SIZES_TELEMETRY_ENUM.DIMENSION;
                  sizeHistogramDimension.add(parseInt(values[1]));
                } else {
                  sizesType = SIZES_TELEMETRY_ENUM.INVALID;
                  break;
                }
              }
            }
          } else {
            sizesType = SIZES_TELEMETRY_ENUM.NO_SIZES;
          }
          sizeHistogramTypes.add(sizesType);

          chromeGlobal.sendAsyncMessage(
            "Link:SetIcon",
            {url: uri.spec, loadingPrincipal: link.ownerDocument.nodePrincipal});
          iconAdded = true;
          break;
        case "search":
          if (!searchAdded && event.type == "DOMLinkAdded") {
            var type = link.type && link.type.toLowerCase();
            type = type.replace(/^\s+|\s*(?:;.*)?$/g, "");

            let re = /^(?:https?|ftp):/i;
            if (type == "application/opensearchdescription+xml" && link.title &&
                re.test(link.href))
            {
              let engine = { title: link.title, href: link.href };
              chromeGlobal.sendAsyncMessage("Link:AddSearch",
                                            {engine: engine,
                                             url: link.ownerDocument.documentURI});
              searchAdded = true;
            }
          }
          break;
      }
    }
  },

  getLinkIconURI: function(aLink) {
    let targetDoc = aLink.ownerDocument;
    var uri = BrowserUtils.makeURI(aLink.href, targetDoc.characterSet);

    // Verify that the load of this icon is legal.
    // Some error or special pages can load their favicon.
    // To be on the safe side, only allow chrome:// favicons.
    var isAllowedPage = [
      /^about:neterror\?/,
      /^about:blocked\?/,
      /^about:certerror\?/,
      /^about:home$/,
    ].some(re => re.test(targetDoc.documentURI));

    if (!isAllowedPage || !uri.schemeIs("chrome")) {
      var ssm = Services.scriptSecurityManager;
      try {
        ssm.checkLoadURIWithPrincipal(targetDoc.nodePrincipal, uri,
                                      Ci.nsIScriptSecurityManager.DISALLOW_SCRIPT);
      } catch(e) {
        return null;
      }
    }

    try {
      var contentPolicy = Cc["@mozilla.org/layout/content-policy;1"].
                          getService(Ci.nsIContentPolicy);
    } catch(e) {
      return null; // Refuse to load if we can't do a security check.
    }

    // Security says okay, now ask content policy
    if (contentPolicy.shouldLoad(Ci.nsIContentPolicy.TYPE_INTERNAL_IMAGE,
                                 uri, targetDoc.documentURIObject,
                                 aLink, aLink.type, null)
                                 != Ci.nsIContentPolicy.ACCEPT)
      return null;

    try {
      uri.userPass = "";
    } catch(e) {
      // some URIs are immutable
    }
    return uri;
  },
};
