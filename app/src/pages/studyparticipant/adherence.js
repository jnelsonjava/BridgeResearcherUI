import BaseAccount from "../../accounts/base_account";
import fn from "../../functions";
import ko from "knockout";
import root from "../../root";
import serverService from "../../services/server_service";
import utils from "../../utils";

export default class StudyParticipantAdherence extends BaseAccount {
  constructor(params) {
    super({ 
      ...params, 
      errorId: 'studyparticipant-adherence',
      notFoundParams: {
        redirectTo: `studies/${params.studyId}/participants`,
        redirectMsg: 'Participant not found'
      }
    });
    this.reportObs = ko.observable();
    this.dateObs = ko.observable('');
    this.activeOnlyObs = ko.observable(false);
    this.editSession = this.editSession.bind(this);

    fn.copyProps(this, fn, "formatDateTime");

    this.activeOnlyObs.subscribe(() => this.load());

    serverService.getStudy(this.studyId).then((response) => {
        this.navStudyNameObs(response.name);
    }).then(() => this.getAccount())
      .then(() => this.load());
  }
  path() {
    return `eventstream?activeOnly=${this.activeOnlyObs()}`;
  }
  load() {
    return serverService.getStudyParticipantAdherenceReport(this.studyId, this.userId, this.path())
      .then(report => {
        this.dateObs(report.timestamp);
        this.reportObs(report);
      })
      .catch(utils.failureHandler({ id: 'studyparticipant-adherence' }));
  }
  link(postfix) {
    return `/studies/${this.studyId}/participants/${encodeURIComponent(this.userId)}/${postfix}`;
  }
  loadAccount() {
    return serverService.getStudyParticipant(this.studyId, this.userId);
  }
  closeDialog() {
    root.closeDialog();
    this.load();
  }
  editSession(eventId, eventTimestamp, instanceGuid, dates) {
    setTimeout(() => {
      root.openDialog("session_editor", { 
        studyId: this.studyId,
        userId: this.userId,
        instanceGuid: instanceGuid, 
        eventId: eventId,
        eventTimestamp: eventTimestamp,
        closeDialog: this.closeDialog.bind(this),
        dates: dates
      });
    }, 1);
  }  
  preview(report) {
    if (report === 'allWeeklies') {
      root.openDialog('preview_dialog', {
        title: 'Preview Adherence Report',
        supplier: () => serverService.getStudyParticipantAdherenceReports(this.studyId, 'weekly?testFilter=test')
      });
    } else {
      root.openDialog('preview_dialog', {
        title: 'Preview Adherence Report',
        supplier: () => serverService.getStudyParticipantAdherenceReport(this.studyId, this.userId, report)
      });
    }
  }
}
