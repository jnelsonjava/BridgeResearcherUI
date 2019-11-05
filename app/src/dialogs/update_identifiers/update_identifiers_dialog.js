import Binder from "../../binder";
import serverService from "../../services/server_service";
import utils from "../../utils";

export default function(params) {
  let self = this;

  new Binder(self)
    .obs("signInEmail")
    .obs("signInPassword")
    .obs("email", params.email)
    .obs("synapseUserId", params.synapseUserId)
    .obs("phone", params.phone, Binder.formatPhone, Binder.persistPhone)
    .obs("phoneRegion", params.phoneRegion)
    .obs("credentialType", "Email")
    .obs("externalId");

  self.isVisible = function(field) {
    return params.editor === field;
  }
  self.lookupSynapseUserId = function(vm, event) {
    let value = self.synapseUserIdObs();
    if (value === '' || /^\d+$/.test(value)) {
      return;
    }
    utils.startHandler(vm, event);
    utils.synapseAliasToUserId(value)
      .then(self.synapseUserIdObs)
      .then(utils.successHandler(self, event))
      .catch(utils.failureHandler());
  };  
  self.updateRegion = function(model, event) {
    if (event.target.classList.contains("item")) {
      self.phoneRegionObs(event.target.textContent);
    }
  };

  self.save = function(vm, event)  {
    utils.startHandler(vm, event);

    const payload = {
      signIn: { study: params.studyId, password: self.signInPasswordObs() },
    };
    if (self.credentialTypeObs() === 'Email') {
      payload.signIn.email = self.signInEmailObs();
    } else if (self.credentialTypeObs() === 'External ID') {
      payload.signIn.externalId = self.externalIdObs();
    } else if (self.credentialTypeObs() === 'Phone') {
      payload.signIn.phone = { number: self.phoneObs(), regionCode: self.phoneRegionObs() };
    }
    if (self.isVisible('email')) {
      payload.emailUpdate = self.emailObs();
    }
    if (self.isVisible('synapseUserId')) {
      payload.synapseUserIdUpdate = new String(self.synapseUserIdObs());
    }
    if (self.isVisible('phone')) {
      payload.phoneUpdate = {number: self.phoneObs(), regionCode: self.phoneRegionObs()};
    }
    serverService.updateIdentifiers(payload)
      .then(() => document.location.reload())
      .catch(utils.failureHandler(vm, event));
  };
  self.cancel = params.closeDialog;
};
