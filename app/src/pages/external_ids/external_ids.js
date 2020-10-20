import Binder from "../../binder";
import fn from "../../functions";
import ko from "knockout";
import password from "../../password_generator";
import root from "../../root";
import serverService from "../../services/server_service";
import tables from "../../tables";
import utils from "../../utils";

export default function externalIds() {
  let self = this;

  self.query = {};
  self.userStudies = [];

  let binder = new Binder(self)
    .obs("items[]", [])
    .obs("total", 0)
    .obs("result", "")
    .obs("searchLoading", false)
    .obs("idFilter")
    .obs("studyId")
    .obs("showResults", false);

  fn.copyProps(self, root, "isAdmin", "isDeveloper", "isResearcher");
  
  tables.prepareTable(self, {
    refresh: () => self.load(self.query),
    name: "external ID",
    delete: (item) => serverService.deleteExternalId(item.identifier),
    id: 'external-ids'
  });

  self.canDeleteObs = ko.computed(() => self.isAdmin());
  self.postLoadPagerFunc = fn.identity;
  self.postLoadFunc = (func) => self.postLoadPagerFunc = func;

  function extractId(response) {
    if (response.items.length === 0) {
      throw new Error(
        "There are no unassigned external IDs registered with your app. Please import more IDs to create more credentials."
      );
    }
    return response.items[0].identifier;
  }
  function createNewCredentials(identifier) {
    self.resultObs(identifier);
    let participant = utils.createParticipantForID(identifier, password.generatePassword(32));
    return serverService.createParticipant(participant);
  }
  function updatePageWithResult(response) {
    self.showResultsObs(true);
    ko.postbox.publish("page-refresh");
    return response;
  }
  function convertToPaged(identifier) {
    return () => { items: [{ identifier }] };
  }
  function initFromSession(session) {
    self.userStudies = session.studyIds;
    return serverService.getApp();
  }

  self.openImportDialog = function(vm, event) {
    self.showResultsObs(false);
    root.openDialog("external_id_importer", {
      vm: self,
      reload: self.load.bind(self)
    });
  };
  self.createFrom = function(data, event) {
    self.showResultsObs(false);
    utils.startHandler(self, event);
    createNewCredentials(data.identifier)
      .then(updatePageWithResult)
      .then(utils.successHandler(self, event))
      .catch(utils.failureHandler({ transient: false, id: 'external-ids' }));
  };
  self.link = (item) => "#/participants/" + encodeURIComponent("externalId:" + item.identifier) + "/general";
  self.doSearch = (event) => {
    event.preventDefault();
    event.stopPropagation();
    self.load(self.query);
  };

  // This is called from the dialog that allows a user to enter a new external identifier.
  self.createFromNew = function(identifier) {
    serverService.addExternalIds([identifier])
      .then(convertToPaged(identifier))
      .then(extractId)
      .then(createNewCredentials)
      .then(updatePageWithResult)
      .then(utils.successHandler())
      .catch(utils.failureHandler({ id: 'external-ids' }));
  };
  self.matchesStudy = (studyId) => fn.studyMatchesUser(self.userStudies, studyId);

  serverService.getSession()
    .then(initFromSession)
    .then(binder.assign("app"));

  self.load = function(query) {
    query = query || {};
    self.query = query;
    self.query.idFilter = self.idFilterObs();
    return serverService.getExternalIds(self.query)
      .then(binder.update("total", "items"))
      .then(self.postLoadPagerFunc)
      //.then(msgIfNoRecords)
      .catch(utils.failureHandler({ id: 'external-ids' }));
  }
  ko.postbox.subscribe('external-ids-refresh', self.load);
};
