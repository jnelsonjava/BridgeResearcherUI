var utils = require('../../utils');
var serverService = require('../../services/server_service');
var storeService = require('../../services/store_service');
var config = require('../../config');
var root = require('../../root');
var bind = require('../../binder');
var BridgeError = require('../../error');

var SUCCESS_MSG = "An email has been sent to that address with instructions on changing your password.";

module.exports = function() {
    var self = this;
    var isLocked = utils.isDefined(root.queryParams.study);
    
    var studyKey, env;    
    if (isLocked) {
        studyKey = root.queryParams.study;
        env = 'production';
    } else {
        studyKey = storeService.get('studyKey') || 'api';
        env = storeService.get('environment') || 'production';
    }
    bind(self)
        .obs('email')
        .obs('title')
        .obs('study', studyKey)
        .obs('environment', env)
        .obs('studyOptions[]')
        .obs('isLocked', isLocked);

    self.environmentOptions = config.environments;
    self.environmentObs.subscribe(function(newValue) {
        self.studyOptionsObs({name:'Updating...',identifier:''});
        loadStudyList(newValue);
    });
    loadStudyList(env);
    
    function loadStudies(studies){
        self.studyOptionsObs(studies.items);
        self.studyObs(studyKey);
        if (self.isLockedObs()) {
            self.titleObs(utils.findStudyName(self.studyOptionsObs(), studyKey));
        }
    }
    
    function loadStudyList(newValue) {
        serverService.getStudyList(newValue)
            .then(loadStudies)
            .catch(utils.failureHandler());
    }
    function openSignInDialog() {
        root.openDialog('sign_in_dialog');
    }

    self.sendResetPasswordRequest = function(vm, event) {
        var env = self.environmentObs();
        var model = {email: self.emailObs(), study: self.studyObs()};
        
        var error = new BridgeError();
        if (!model.email) {
            error.addError("email", "is required");
        }
        if (!model.study) {
            error.addError("study", "is required");
        }
        if (error.hasErrors()) {
            return utils.failureHandler()(error);
        }

        storeService.set('environment', self.environmentObs());
        storeService.set('studyKey', self.studyObs());

        utils.startHandler(self, event);
        serverService.requestResetPassword(env, model)
            .then(openSignInDialog)
            .then(utils.successHandler(self, event, SUCCESS_MSG))
            .catch(utils.failureHandler());
    };

    self.cancel = openSignInDialog;
};