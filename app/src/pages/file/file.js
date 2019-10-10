import Binder from "../../binder";
import fn from "../../functions";
import ko from 'knockout';
import root from '../../root';
import serverService from "../../services/server_service";
import tables from '../../tables';
import toastr from 'toastr';
import utils from "../../utils";

let failureHandler = utils.failureHandler({
  redirectMsg: "File not found.",
  redirectTo: "files",
  transient: false
});
const cssClassNameForStatus = {
  pending: "warning",
  available: ""
};

export default function editor(params) {
  let self = this;
  self.file = {};
  self.query = {}; // capture this for when the *parent* wants to refresh the page
  self.isNewObs = ko.observable(params.guid === 'new');
  self.guidObs = ko.observable(params.guid);
  self.titleObs = ko.observable("");

  fn.copyProps(self, fn, 'formatDateTime', 'formatTitleCase', 'formatFileSize');

  // capture post-processing of the pager control
  self.postLoadPagerFunc = () => {};
  self.postLoadFunc = function(func) {
    self.postLoadPagerFunc = func;
  }
  tables.prepareTable(self, {
    name: "file revisions",
    type: "File Revisions",
    refresh: () => loadRevisions(self.query)
  });

  let binder = new Binder(self)
    .obs("isNew", params.guid === "new")
    .obs("title", "New File")
    .bind("name")
    .bind("guid")
    .bind("description")
    .bind("createdOn")
    .bind("modifiedOn")
    .bind("version");

  function updateModifiedOn(response) { 
    self.modifiedOnObs(new Date().toISOString());
    self.titleObs(self.nameObs());
    return response;
  }
  function saveFile(file) {
    if (self.isNewObs()) {
      return serverService.createFile(file.guid, file).then(response => {
        document.location = "#/files/" + response.guid;
        return response;
      });
    }
    return serverService.updateFile(file.guid, file)
      .then(updateModifiedOn)
      .then(fn.handleObsUpdate(self.versionObs, "version"))
      .then(fn.handleStaticObsUpdate(self.isNewObs, false));
  }
  function load() {
    if (self.isNewObs()) {
      return Promise.resolve({version:0})
        .then(binder.assign("file"))
        .then(binder.update());
    } else {
      return serverService.getFile(params.guid)
        .then(binder.assign("file"))
        .then(binder.update())
        .then(fn.handleObsUpdate(self.titleObs, "name"))
        .catch(failureHandler);
    }
  }
  function loadRevisions(query) {
    if (self.isNewObs()) {
      return Promise.resolve({});
    }
    // some state is not in the pager, update that and capture last known state of paging
    self.query = query;

    return serverService.getFile(params.guid)
      .then(fn.handleObsUpdate(self.titleObs, "name"))
      .then(() => serverService.getFileRevisions(params.guid, query))
      .then(fn.handleSort("items", "label"))
      .then(fn.handleObsUpdate(self.itemsObs, "items"))
      .then(self.postLoadPagerFunc)
      .catch(utils.failureHandler());
  }

  self.save = function(vm, event) {
    self.file = binder.persist(self.file);

    utils.startHandler(vm, event);
    saveFile(self.file)
      .then(utils.successHandler(vm, event, "File has been saved."))
      .catch(failureHandler);
  };
  self.verify = function(item, event) {
    utils.startHandler(item, event);
    serverService.finishFileRevision(item.fileGuid, item.createdOn)
      .then(utils.successHandler(item, event))
      .then(() => loadRevisions(self.query))
      .catch(() => {
        loadRevisions(self.query).then(() => {
          toastr.error("Revision could not be found, removed from list.");
        });
      });
  };
  self.classNameForStatus = (item) => cssClassNameForStatus[item.status];
  self.newRevisionDialog = function(vm, event) {
    root.openDialog("file_upload", {
      closeFunc: fn.seq(root.closeDialog, () => {
        self.query.offsetBy = 0;
        loadRevisions(self.query)
      }),
      guid: params.guid
    });
  };

  if (!self.isNewObs()) {
    load();
    loadRevisions(self.query);
  }
  ko.postbox.subscribe('fr-refresh', loadRevisions);
};
