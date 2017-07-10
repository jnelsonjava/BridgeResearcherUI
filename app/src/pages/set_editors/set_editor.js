import Binder from '../../binder';
import BridgeError from '../../bridge_error';
import fn from '../../functions';
import root from '../../root';
import serverService from '../../services/server_service';
import utils from '../../utils';

module.exports = function(propertyName) {
    return function () {
        var self = this;
        
        var binder = new Binder(self)
            .obs('records[]')
            .obs('newRecords[]')
            .obs('addField')
            .obs('noChanges', true);

        self.isPublicObs = root.isPublicObs;
        self.keyHandler = function(view, e) {
            if (e.keyCode === 13) {
                self.add();
                return false;
            }
            return true;
        };
        self.remove = function(attribute) {
            self.newRecordsObs.remove(attribute);
            self.noChangesObs(self.newRecordsObs().length === 0);
        };
        self.add = function() {
            var error = new BridgeError();
            if (!self.addFieldObs()) {
                error.addError("value", "is required");
            }
            if (self.recordsObs.contains(self.addFieldObs()) || 
                self.newRecordsObs.contains(self.addFieldObs())) {
                error.addError("value", "must be unique");
            }
            // If it's a dataGroup entry, it has to meet some string validation criteria.
            if (propertyName === "dataGroups" && !/^[a-zA-Z0-9_-]+$/.test(self.addFieldObs())) {
                error.addError("value", "can only be letters, numbers, underscores and dashes");
            }
            if (error.hasErrors()) {
                return utils.failureHandler()(error);
            }
            var array = self.newRecordsObs();
            array.push(self.addFieldObs());
            array.sort(fn.lowerCaseStringSorter);
            self.newRecordsObs(array);
            self.addFieldObs("");
            self.noChangesObs(self.newRecordsObs().length === 0);
        };
        self.save = function(vm, event) {
            var array = [].concat(self.recordsObs());
            self.newRecordsObs().forEach(function(identifier) {
                array.push(identifier);
            });

            utils.startHandler(self, event);
            self.study[propertyName] = array;
            serverService.saveStudy(self.study)
                .then(serverService.getStudy)
                .then(updateTaskIdentifiers)
                .then(fn.handleStaticObsUpdate(self.noChangesObs, true))
                .then(utils.successHandler(self, event, "Values saved."))
                .catch(utils.failureHandler({transient:false}));
        };

        function updateTaskIdentifiers(study) {
            self.newRecordsObs([]);
            study[propertyName].sort();
            self.recordsObs(study[propertyName]);
            return study;
        }

        serverService.getStudy()
            .then(updateTaskIdentifiers)
            .then(binder.assign('study'))
            .catch(utils.failureHandler());
    };
};
