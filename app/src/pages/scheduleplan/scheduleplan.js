var ko = require('knockout');
var serverService = require('../../services/server_service');
var scheduleUtils = require('./../schedule/schedule_utils');
var utils = require('../../utils');
var bind = require('../../binder');
var fn = require('../../transforms');

/**
 * The complexity of this view comes from the fact that the entire data model is in the strategy,
 * and the strategy can entirely change the data model.
 * @param params
 */
module.exports = function(params) {
    var self = this;
    
    var binder = bind(self)
        // The callback function will be called when saving the schedule plan; the strategy 
        // implementation must implement this callback to return a strategy object.
        .bind('strategy', null, fn.initObsCallback, fn.callObsCallback)
        .bind('label', '')
        .bind('minAppVersion', '')
        .bind('maxAppVersion', '')
        .obs('schedulePlanType', 'SimpleScheduleStrategy')

    // Fields for this form
    self.schedulePlanTypeOptions = scheduleUtils.TYPE_OPTIONS;
    self.schedulePlanTypeLabel = utils.makeOptionLabelFinder(scheduleUtils.TYPE_OPTIONS);
    
    self.schedulePlanTypeObs.subscribe(function(newValue) {
        if (newValue === 'SimpleScheduleStrategy') {
            self.strategyObs(scheduleUtils.newSimpleStrategy());
        } else if (newValue === 'ABTestScheduleStrategy') {
            self.strategyObs(scheduleUtils.newABTestStrategy());
        } else if (newValue === 'CriteriaScheduleStrategy') {
            self.strategyObs(scheduleUtils.newCriteriaStrategy());
        }
    });

    self.save = function(vm, event) {
        self.plan = binder.persist(self.plan);
        utils.deleteUnusedProperties(self.plan);

        utils.startHandler(self, event);
        serverService.saveSchedulePlan(self.plan)
            .then(utils.successHandler(self, event, "The schedule plan has been saved."))
            .catch(utils.failureHandler(self, event));
    };
    self.updateType = function(vm, event) {
        var spType = event.target.getAttribute('data-type');
        if (spType) {
            self.schedulePlanTypeObs(event.target.getAttribute('data-type'));
        }
    };

    var notFoundHandler = utils.notFoundHandler(self, "Schedule plan not found.", "#/scheduleplans");

    // binder doesn't know how to update an observable from a completely different, nested property...
    function updateScheduleTypeObs(plan) {
        self.schedulePlanTypeObs(plan.strategy.type);
        return plan;
    }

    scheduleUtils.loadOptions().then(function() {
        var promise = (params.guid !== "new") ?
            serverService.getSchedulePlan(params.guid) :
            Promise.resolve(scheduleUtils.newSchedulePlan());
        promise.then(binder.assign('plan'))
            .then(updateScheduleTypeObs)
            .then(binder.update())
            .catch(notFoundHandler);
    });
}