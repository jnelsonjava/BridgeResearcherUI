import {serverService} from './services/server_service';
import alerts from './widgets/alerts';
import Binder from './binder';
import clipboard from './widgets/clipboard/clipboard';
import config from './config';
import ko from 'knockout';

function roleFunc(observer, role) {
    return ko.computed(function() {return observer().indexOf(role) > -1;});
}
function checkVerifyStatus() {
    serverService.emailStatus().then(unverifiedEmailAlert);
}
function unverifiedEmailAlert(response) {
    if (response.status !== 'verified') {
        alerts.warn("To send email, the owner of your support email address\n"+
            "must verify the address.\n\n"+
            "See under Settings > Email to resend a request.\n\n"+
            "You will not be able to send email until this step is completed.");
    }
}

var RootViewModel = function() {
    var self = this;

    new Binder(self)
        .obs('environment', '')
        .obs('studyName', '')
        .obs('studyIdentifier')
        .obs('selected', '')
        .obs('roles[]', [])
        .obs('mainPage', 'dailyUploads')
        .obs('mainParams', {})
        .obs('editorPanel', 'none')
        .obs('editorParams', {})
        .obs('codesEnumerated', false)
        .obs('codeRequired', false)
        .obs('isEditorTabVisible', false)
        .obs('notificationsEnabled', false)
        .obs('sidePanel', 'navigation')
        .obs('showNavigation', true)
        .obs('dialog', {name: 'none'});

    self.clipboard = clipboard;

    self.mainPageObs.subscribe(self.selectedObs);
    self.mainPageObs.subscribe(function() {
        self.setEditorPanel('none',{});
    });
    self.showNav = function() {
        self.showNavigationObs(true);
    };
    self.hideNav = function() {
        self.showNavigationObs(false);
    };
    self.setEditorPanel = function(name, params) {
        self.editorPanelObs(name);
        self.editorParamsObs(params);
        self.isEditorTabVisibleObs(name !== 'none');
        self.sidePanelObs('editor');
    };
    self.setSidebarPanel = function(vm, event) {
        if (event.target.nodeName === "A") {
            self.sidePanelObs(event.target.textContent.toLowerCase());
        }
    };
    self.isSidebarActive = function(tag) {
        return self.sidePanelObs() === tag;
    };
    self.signOut = function() {
        serverService.signOut();
    };
    self.changeView = function(name, params) {
        self.isEditorTabVisibleObs(false);
        self.sidePanelObs('navigation');
        self.mainPageObs(name);
        self.mainParamsObs(params);
    };
    self.readAboutClipboard = function() {
        self.openDialog('read_about_clipboard');
    };

    self.isResearcher = roleFunc(self.rolesObs, 'researcher');
    self.isDeveloper = roleFunc(self.rolesObs, 'developer');
    self.isAdmin = roleFunc(self.rolesObs, 'admin');
    self.isSharedStudy = ko.computed(function() {
        return self.studyIdentifierObs() === 'shared';
    });
    self.isResearcherOnly = ko.computed(function() {
        var roles = self.rolesObs();
        return roles.indexOf("researcher") > -1 && roles.indexOf("developer") === -1;
    });

    self.openDialog = function(dialogName, params) {
        self.dialogObs({name: dialogName, params: params});
    };
    self.closeDialog = function() {
        self.dialogObs({name: 'none'});
    };
    self.isDevEnvObs = ko.computed(function() {
        return ['local','develop','staging'].indexOf(self.environmentObs()) > -1; 
    });
    serverService.addSessionStartListener(function(session) {
        self.studyNameObs(session.studyName);
        self.environmentObs(session.environment);
        self.studyIdentifierObs(session.studyId);
        self.rolesObs(session.roles);
        // This interferes with reauthentication behavior when we use it. Not sure if it
        // is required by any code path at this point to properly close the dialog.
        // self.closeDialog();
        serverService.getStudy().then(function(study) {
            // Until we can support on server, enumerating the codes is the same as requiring the code at sign up.
            // codesEumerated = externalIdValidationEnabled
            // codeRequired = externalIdRequiredOnSignUp
            var defaults = {
                codesEnumerated: study.externalIdValidationEnabled,
                codeRequired: study.externalIdRequiredOnSignUp,
                notificationsEnabled: Object.keys(study.pushNotificationARNs).length > 0
            };
            var studyConfig = config.studies[study.identifier] || {};
            var opts = Object.assign({}, defaults, studyConfig);
            
            self.codesEnumeratedObs(opts.codesEnumerated);
            self.codeRequiredObs(opts.codeRequired);
            self.notificationsEnabledObs(opts.notificationsEnabled);
            console.debug("[config]", Object.keys(opts).map(function(key) { return key + "=" + opts[key]; }).join(', '));
        });
    });
    serverService.addSessionEndListener(function(session) {
        self.studyNameObs("");
        self.environmentObs("");
        self.studyIdentifierObs("");
        self.rolesObs([]);
        self.codesEnumeratedObs(false);
        self.codeRequiredObs(false);
        self.openDialog('sign_in_dialog');
    });
    setTimeout(checkVerifyStatus, 1000);
};

var root = new RootViewModel();

root.queryParams = {};
if (document.location.search) {
    document.location.search.substring(1).split("&").forEach(function(pair) {
        var fragments = pair.split("=");
        root.queryParams[decodeURIComponent(fragments[0])] = decodeURIComponent(fragments[1]);
    });
}
console.debug("root.queryParams", root.queryParams);

export default root;

window.addEventListener("DOMContentLoaded", function() {
    ko.applyBindings(root, document.body);
    document.body.style.opacity = "1.0";
}, false);