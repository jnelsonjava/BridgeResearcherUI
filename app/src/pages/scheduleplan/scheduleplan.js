var serverService = require('../../services/server_service');
var scheduleUtils = require('./../schedule/schedule_utils');
var utils = require('../../utils');
var bind = require('../../binder');
var tx = require('../../transforms');
var optionsService = require('../../services/options_service');
var Promise = require('bluebird');

var failureHandler = utils.failureHandler({
    redirectTo: "scheduleplans",
    redirectMsg: "Schedule plan not found."
});

/**
 * The complexity of this view comes from the fact that the entire data model is in the strategy,
 * and the strategy can entirely change the data model.
 * @param params
 */
module.exports = function(params) {
    var self = this;
    
    // The callback function will be called when saving the schedule plan; the strategy 
    // implementation must implement this callback to return a strategy object.
    var binder = bind(self)
        .bind('strategy', null, null, tx.callObsCallback)
        .bind('label', '')
        .obs('schedulePlanType', (params.guid==="new") ? 'SimpleScheduleStrategy' : 'empty');
        
    self.strategyObs.callback = utils.identity;
    // Fields for this form
    self.schedulePlanTypeOptions = scheduleUtils.TYPE_OPTIONS;
    self.schedulePlanTypeLabel = utils.makeOptionLabelFinder(scheduleUtils.TYPE_OPTIONS);

    self.schedulePlanTypeObs.subscribe(function(newType) {
        if (self.strategyObs.callback()) {
            var newStrategy = scheduleUtils.newStrategy(newType, self.strategyObs.callback());
            self.strategyObs(newStrategy);
        }
    });

    self.save = function(vm, event) {
        self.plan = binder.persist(self.plan);
        utils.deleteUnusedProperties(self.plan);

        utils.startHandler(self, event);
        serverService.saveSchedulePlan(self.plan)
            .then(utils.successHandler(self, event, "The schedule plan has been saved."))
            .catch(failureHandler);
    };
    self.updateType = function(vm, event) {
        var spType = event.target.getAttribute('data-type');
        if (spType) {
            self.schedulePlanTypeObs(event.target.getAttribute('data-type'));
        }
    };

    // binder doesn't know how to update an observable from a completely different, nested property...
    function updateScheduleTypeObs(plan) {
        self.schedulePlanTypeObs(plan.strategy.type);
        return plan;
    }
    function resolveActivity(activity) {
        return serverService.getTaskDefinition(activity.compoundActivity.taskIdentifier)
            .then(function(task) {
                activity.compoundActivity = task;
                activity.compoundActivity.taskIdentifier = task.taskId;
                return activity;
            })
            .catch(failureHandler);
    }
    function isCompoundActivity(activity) {
        return activity.activityType === "compound";
    }
    // These are not actually filled out on the server.
    function addCompoundActivitiesToPlan(plan) {
        var activities = optionsService.getActivities(plan).filter(isCompoundActivity);
        return Promise.map(activities, resolveActivity).then(function() {
            return plan;
        });
    }
    function schedulePlan() {
        return (params.guid !== "new") ?
            serverService.getSchedulePlan(params.guid) :
            Promise.resolve(scheduleUtils.newSchedulePlan());
    }

    scheduleUtils.loadOptions().then(function() {
        schedulePlan().then(addCompoundActivitiesToPlan)
            .then(binder.assign('plan'))
            .then(updateScheduleTypeObs)
            .then(binder.update())
            .catch(failureHandler);
    });
};