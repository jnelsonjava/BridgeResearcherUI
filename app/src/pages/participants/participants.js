import Binder from "../../binder";
import fn from "../../functions";
import ko from "knockout";
import root from "../../root";
import serverService from "../../services/server_service";
import storeService from "../../services/store_service";
import tables from "../../tables";
import utils from "../../utils";
import optionsService from "../../services/options_service";

const cssClassNameForStatus = {
  disabled: "negative",
  unverified: "warning",
  verified: ""
};

function assignClassForStatus(participant) {
  // does not have sharing scope so we can't show it on summary page.
  return cssClassNameForStatus[participant.status];
}
function getId(id) {
  return serverService.getParticipant(id);
}
function getHealthCode(id) {
  return serverService.getParticipant("healthCode:" + id);
}
function getExternalId(id) {
  return serverService.getParticipant("externalId:" + id);
}
function getSynapseUserId(id) {
  return serverService.getParticipant("synapseUserId:" + id);
}
function getEmail(id) {
  return serverService.getParticipants(0, 5, id).then(function(response) {
    return response.items.length === 1 ? 
      serverService.getParticipant(response.items[0].id) : 
      Promise.reject("Participant not found");
  });
}
function makeSuccess(vm, event) {
  return function(response) {
    event.target.parentNode.parentNode.classList.remove("loading");
    document.location = `#/participants/${response.id}/general`;
  };
}

export default class Participants {
  constructor(params) {
    this.total = 0;
    this.classNameForStatus = assignClassForStatus;
    this.loadingFunc = this.loadingFunc.bind(this);
    
    this.search = storeService.restoreQuery("p", "allOfGroups", "noneOfGroups");

    fn.copyProps(this, fn, "formatName", "formatDateTime", "formatIdentifiers", "formatNameAsFullLabel");
    fn.copyProps(this, root, "isAdmin", "isDeveloper", "isResearcher");

    let { defaultStart, defaultEnd } = fn.getRangeInDays(-14, 0);

    tables.prepareTable(this, {
      name: "participant",
      id: "participants",
      delete: (item) => serverService.deleteParticipant(item.id),
      refresh: () => ko.postbox.publish("participants")
    });

    this.binder = new Binder(this)
      .obs("find")
      .obs("emailFilter", this.search.emailFilter)
      .obs("phoneFilter", this.search.phoneFilter)
      .obs("externalIdFilter", this.search.externalIdFilter)
      .obs("startTime", this.search.startTime || defaultStart)
      .obs("endTime", this.search.endTime || defaultEnd)
      .obs("formattedSearch", "")
      .obs("language", this.search.language)
      .obs("dataGroups[]", this.search.dataGroups)
      .obs("allOfGroups[]", this.search.allOfGroups)
      .obs("noneOfGroups[]", this.search.noneOfGroups)
      .obs("status", this.search.status)
      .obs("enrollment", this.search.enrollment)
      .obs("attributeKey", this.search.attributeKey)
      .obs("attributeValueFilter", this.search.attributeValueFilter)
      .obs("attributeKeys[]", [])
      .obs("adminOnly")
      .obs('searchLoading');

    optionsService.getOrganizationNames()
      .then(map => this.orgNames = map)
      .then(() => optionsService.getStudyNames())
      .then(map => this.studyNames = map)
      .then(() => ko.postbox.publish('participants'));
  }
  formatStudyName(id) {
    return this.studyNames[id];
  }
  formatOrgName(id) {
    return this.orgNames[id];
  }
  exportDialog() {
    root.openDialog("participant_export", { total: this.total, search: this.search });
  }
  doFormSearch(vm, event) {
    if (event.keyCode === 13)  {
      ko.postbox.publish('participants', 0);
    }
    return false;
  }
  searchButton() {
    ko.postbox.publish('participants', 0);
  }
  doSearch(event) {
    event.target.parentNode.parentNode.classList.add("loading");

    let id = this.findObs().trim();
    let success = makeSuccess(this, event);
    utils.startHandler(this, event);

    let promise = null;
    if (id.endsWith('@synapse.org')) {
      promise = utils.synapseAliasToUserId(id)
        .then(getSynapseUserId).then(success);
    } else {
      promise = getHealthCode(id).then(success).catch(() => {
        getExternalId(id).then(success).catch(() => {
          getId(id).then(success).catch(() => {
            getSynapseUserId(id).then(success).catch(() => {
              getEmail(id).then(success).catch((e) => {
                event.target.parentNode.parentNode.classList.remove("loading");
                utils.failureHandler({ transient: false, id: "participants" })(e);
              });
            });
          });
        });
      });
    }
    promise.catch(utils.failureHandler({id: 'participants'}));
  }
  clear() {
    this.emailFilterObs(null);
    this.phoneFilterObs(null);
    this.externalIdFilterObs(null);
    this.startTimeObs(null);
    this.endTimeObs(null);
    this.languageObs(null);
    this.allOfGroupsObs([]);
    this.noneOfGroupsObs([]);
    this.statusObs(null);
    this.enrollmentObs('all');
    this.attributeKeyObs(null);
    this.attributeValueFilterObs(null);
    this.adminOnly(null);
    ko.postbox.publish('participants', 0)
  }  
  loadingFunc(search) {
    search = search || this.search;

    search.emailFilter = this.emailFilterObs();
    search.phoneFilter = this.phoneFilterObs();
    search.externalIdFilter = this.externalIdFilterObs();
    search.allOfGroups = this.allOfGroupsObs();
    search.noneOfGroups = this.noneOfGroupsObs();
    search.language = this.languageObs() ? this.languageObs() : null;
    search.startTime = this.startTimeObs();
    search.endTime = this.endTimeObs();
    search.status = this.statusObs();
    search.enrollment = this.enrollmentObs();
    if (this.attributeValueFilterObs()) {
      search.attributeKey = this.attributeKeyObs();
      search.attributeValueFilter = this.attributeValueFilterObs();
    } else {
      delete search.attributeKey;
      delete search.attributeValueFilter;
    }
    search.adminOnly = this.adminOnlyObs();
    if (search.status === '') {
      delete search.status;
    }
    if (search.enrollment === '') {
      delete search.enrollment;
    }
    if (fn.is(search.startTime, "Date")) {
      search.startTime.setHours(0, 0, 0, 0);
    }
    if (fn.is(search.endTime, "Date")) {
      search.endTime.setHours(23, 59, 59, 999);
    }

    this.search = search;
    storeService.persistQuery("p", search);
    this.formattedSearchObs(fn.formatSearch(search));

    utils.clearErrors();
    return serverService.searchAccountSummaries(search)
      .then(fn.handleObsUpdate(this.itemsObs, "items"))
      .catch(utils.failureHandler({ id: "participants" }));
  }  
}
