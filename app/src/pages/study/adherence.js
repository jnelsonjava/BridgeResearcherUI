import BaseStudy from "./base_study";
import fn from "../../functions";
import ko from "knockout";
import root from "../../root";
import serverService from "../../services/server_service";
import tables from "../../tables";

export default class StudyAdherence extends BaseStudy {
  constructor(params) {
    super(params, 'adherence');
    this.studyId = params.studyId;
    this.study = null;
  
    fn.copyProps(this, fn, 'formatDate', 'formatDateTime', 'formatNameAsFullLabel');
    fn.copyProps(this, root, 'isAdmin');
    
    this.postLoadPagerFunc = fn.identity;
    this.postLoadFunc = (func) => this.postLoadPagerFunc = func;

    this.binder
      .obs('label')
      .obs('test', 'both')
      .obs('formattedSearch', '')
      .obs('progression')
      .obs('id')
      .obs('range', '0-100');

    tables.prepareTable(this, {
      name: "weekly adherence report",
      type: "Weekly Adherence Report",
      id: "adherence",
      refresh: () => ko.postbox.publish('adh-refresh', 0)
    });
    this.loadingFunc = this.loadingFunc.bind(this);
    super.load().then(() => ko.postbox.publish('adh-refresh', 0));
  }
  loadingFunc(offsetBy) {
    let query = {offsetBy, pageSize: 50};
    query.testFilter = this.testObs();
    let range = this.rangeObs();
    if (/^\d{1,3}-\d{1,3}$/.test(range)) {
      let parts = range.split('-');
      query.adherenceMin = parseInt(parts[0]);
      query.adherenceMax = parseInt(parts[1]);
    }
    if (this.labelObs()) {
      query.labelFilters = [this.labelObs()];
    }
    if (this.progressionObs()) {
      query.progressionFilter = this.progressionObs();
    }
    if (this.idObs()){ 
      query.idFilter = this.idObs();
    }
    return serverService.getStudyParticipantAdherenceReports(this.studyId, query)
      .then(this.postLoadPagerFunc)
      .then(this.formatSearch.bind(this))
      .then(fn.handleObsUpdate(this.itemsObs, "items"))
      .catch(this.failureHandler);
  }
  formatActivity(entry) {
    if (entry.studyBurstId) {
      return `${entry.studyBurstId} ${entry.studyBurstNum} (Week ${entry.week})`;
    }
    return `${entry.sessionName} (Week ${entry.week})`
  }
  formatNextActivity(entry) {
    if (!entry)  {
      return ';'
    }
    return 'Next activity on ' + this.formatDate(entry.startDate);
  }
  formatSearch(res) {
    let array = [];
    if (this.idObs()) {
      array.push(`identifier includes “${this.idObs()}”`);
    }
    if (this.labelObs()) {
      array.push(`labels include “${this.labelObs()}”`);
    }
    if (this.testObs() && this.testObs() !== 'both') {
      array.push(`accounts are ${this.testObs()} accounts`);
    }
    if (this.progressionObs()) {
      array.push(`study is ${this.progressionObs().replace("_", " ")} for user`);
    }
    let range = this.rangeObs();
    if (range !== '0-100' && /^\d{1,3}-\d{1,3}$/.test(range)) {
      array.push(`adherence is in range ${range}%`);
    }
    if (array.length) {
      this.formattedSearchObs('Search for all reports where ' + 
        fn.formatList(array, "and", "; "));
    } else {
      this.formattedSearchObs('Search for all reports');  
    }
    return res;
  }
  formatProgression(entry) {
    return (entry.progression === 'unstarted') ? '— Unstarted —' : '— Done —';
  }
  formatWin(report, day, index) {
    let entry = report.byDayEntries[day][index];
    return entry.timeWindows
      .map(win => `<span title="${entry.startDate}" class="bar ${win.state}"></span>`)
      .join('');
  }
  doFormSearch() {
    ko.postbox.publish('adh-refresh', 0);
  }
  clear() {
    this.testObs('both');
    this.labelObs('');
    this.rangeObs('0-100');
    this.formattedSearchObs('');
    this.idObs('');
    this.progressionObs(null);
    ko.postbox.publish('adh-refresh', 0);
  }
}