import Binder from "../../binder";
import fn from "../../functions";
import ko from "knockout";

// TODO: Check what happens if you sign up with a phone number that has US country code
// with a Nigerian phone number

export default function(params) {
  let self = this;

  let phone = params.phoneObs();

  new Binder(self)
    .obs("phoneNumber", (phone) ? phone.number : '')
    .obs("phoneRegion", (phone) ? phone.regionCode : 'US')
    .obs('countries', fn.SUPPORTED_COUNTRIES);

  self.phoneNumberObs.subscribe(newValue => {
    updatePhone(newValue, self.phoneRegionObs());
  });
  self.phoneRegionObs.subscribe(newValue => {
    updatePhone(self.phoneNumberObs(), newValue);
  });
  function updatePhone(number, regionCode) {
    if (number && regionCode) {
      params.phoneObs({number, regionCode});
    } else {
      params.phoneObs(null);
    }
  }

  self.updateRegion = function(model, event) {
    let context = ko.contextFor(event.target);
    if (context && context.$index) {
      let item = fn.SUPPORTED_COUNTRIES[context.$index()];
      self.phoneRegionObs(item.regionCode);
    }
  };
};