import fn from "../../functions";
import ko from "knockout";

export default function tabset(params) {
  let self = this;

  if (!params.isNewObs) {
    params.isNewObs = ko.observable(false);
  }
  fn.copyProps(self, params, "isNewObs", "studyIdObs", "userIdObs", "statusObs", "dataGroupsObs");

  self.computeds = [];
  self.linkMaker = function(postfix) {
    let c = ko.computed(function() {
      return `#/studies/${self.studyIdObs()}/participants/${encodeURIComponent(self.userIdObs())}/${postfix}`;
    });
    self.computeds.push(c);
    return c;
  };
};
tabset.prototype.dispose = function() {
  this.computeds.forEach(function(c) {
    c.dispose();
  });
};
