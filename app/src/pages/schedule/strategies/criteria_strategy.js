var ko = require('knockout');
require('knockout-postbox');
var utils = require('../../../utils');
var scheduleUtils = require('../schedule_utils');
var criteriaUtils = require('../../../criteria_utils');
var root = require('../../../root');

function groupToObservables(group) {
    group.criteriaObs = ko.observable(group.criteria);
    group.scheduleObs = ko.observable(group.schedule);
    group.scheduleObs.callback = utils.identity;
    group.labelObs = ko.computed(function() {
        return criteriaUtils.label(group.criteriaObs());
    });
    return group;
}

function observablesToGroup(group) {
    return {
        criteria: group.criteriaObs(),
        schedule: group.scheduleObs.callback(),
        type: 'ScheduleCriteria'
    };
}

function newGroup() {
    return groupToObservables({
        criteria: criteriaUtils.newCriteria(),
        schedule: scheduleUtils.newSchedule()
    });
}

module.exports = function(params) {
    var self = this;

    self.labelObs = params.labelObs;
    self.strategyObs = params.strategyObs;
    self.collectionName = params.collectionName;
    self.scheduleCriteriaObs = ko.observableArray([]).publishOn("scheduleCriteriaChanges");

    params.strategyObs.callback = function () {
        var strategy = params.strategyObs();
        strategy.scheduleCriteria = self.scheduleCriteriaObs().map(observablesToGroup);
        return strategy;
    };

    root.setEditorPanel('CriteriaScheduleStrategyPanel', {viewModel:self});

    // This is fired when the parent viewModel gets a plan back from the server
    ko.computed(function () {
        var strategy = params.strategyObs();
        if (strategy && strategy.scheduleCriteria) {
            self.scheduleCriteriaObs(strategy.scheduleCriteria.map(groupToObservables));
            root.setEditorPanel('CriteriaScheduleStrategyPanel', {viewModel:self});
        }
    });

    var scrollTo = utils.makeScrollTo(".schedulegroup-fieldset");
    self.fadeUp = utils.fadeUp();

    self.addCriteria = function(vm, event) {
        self.scheduleCriteriaObs.push(newGroup());
        scrollTo(self.scheduleCriteriaObs().length-1);
    };
    self.removeCriteria = utils.animatedDeleter(scrollTo, self.scheduleCriteriaObs);

    self.selectCriteria = function(group) {
        var index = self.scheduleCriteriaObs.indexOf(group);
        scrollTo(index);
    };

    ko.postbox.subscribe("scheduleCriteriaAdd", self.addCriteria);
    ko.postbox.subscribe("scheduleCriteriaRemove", self.removeCriteria);
    ko.postbox.subscribe("scheduleCriteriaSelect", self.selectCriteria);
};