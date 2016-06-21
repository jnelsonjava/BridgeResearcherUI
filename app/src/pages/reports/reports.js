var serverService = require('../../services/server_service');
var utils = require('../../utils');
var root = require('../../root');
var tables = require('../../tables');

module.exports = function() {
    var self = this;

    self.isDeveloper = root.isDeveloper;

    tables.prepareTable(self, "report", "#/reports", function(item) {
        return serverService.deleteStudyReport(item.identifier);
    });
    self.addReport = function(vm, event) {
        root.openDialog('add_report', {
            closeDialog: self.closeDialog, 
            type: "study"
        });
    };
    self.closeDialog = function() {
        root.closeDialog();
        load();
    };

    function load() {
        serverService.getStudyReports().then(function(response) {
            self.itemsObs(response.items.sort(utils.makeFieldSorter("identifier")));
        });
    }
    load();
};