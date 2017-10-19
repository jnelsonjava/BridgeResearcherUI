import fn from '../../functions';
import ko from 'knockout';
import root from '../../root';

module.exports = function(params) {
    var self = this;

    fn.copyProps(self, params, 'isNewObs', 'isPublicObs', 'userIdObs', 'statusObs');

    self.computeds = [];
    self.linkMaker = function(postfix) {
        var c = ko.computed(function() {
            return root.userPath() + self.userIdObs() + '/' + postfix;
        });
        self.computeds.push(c);
        return c;
    };
};
module.exports.prototype.dispose = function() {
    this.computeds.forEach(function(c) {
        c.dispose();
    });
};