import alerts from "../../widgets/alerts";
import BaseAccount from "../../accounts/base_account";
import fn from "../../functions";
import ko from "knockout";
import root from "../../root";
import serverService from "../../services/server_service";
import tables from "../../tables";
import utils from "../../utils";

function sortRes(res) {
  res.items.sort(sorter);
  return res;
}

function sorter(a, b) {
  let ka = (a.originEventId) ? a.originEventId : a.eventId;
  let kb = (b.originEventId) ? b.originEventId : b.eventId;
  return ka.localeCompare(kb);
}

export default class StudyParticipantSchedule extends BaseAccount {
  constructor(params) {
    super({ 
      ...params, 
      errorId: 'studyparticipant-schedule',
      notFoundParams: {
        redirectTo: `studies/${params.studyId}/participants`,
        redirectMsg: 'Participant not found'
      }
    });
    fn.copyProps(this, fn, "formatDateTime", "formatDaysSince");
    this.customUpdateTypes = {};

    tables.prepareTable(this, { 
      name: "activity events",
      id: this.failureParams.id
    });
    serverService.getStudy(this.studyId).then(study => {
        this.navStudyNameObs(study.name);
        study.customEvents.forEach(e => 
          this.customUpdateTypes['custom:'+e.eventId] = e.updateType);
        return study;
      })
      .then(study => {
        if (study.scheduleGuid) {
          serverService.getStudySchedule(this.studyId)
            .then(study => this.collectScheduleStudyBursts(study))
        }
      })
      .then(() => this.getAccount())
      .then(() => serverService.getStudyParticipantActivityEvents(this.studyId, this.userId))
      .then(sortRes)
      .then(res => this.itemsObs(res.items))
      .catch(utils.failureHandler(this.failureParams));
  }
  collectScheduleStudyBursts(schedule) {
    schedule.studyBursts.forEach(burst => {
      for (var i=0; i < burst.occurrences; i++) {
        let iter = (burst.occurrences < 10) ? ('0'+(i+1)) : i+1;
        this.customUpdateTypes[`study_burst:${burst.identifier}:${iter}`] = burst.updateType;
      }
    });
  }
  formatUpdateType(eventId) {
    return this.customUpdateTypes[this.formatEventId(eventId)] || 'system';
  }
  formatShortUpdateType(item) {
    return this.canEdit(item) ? 'Y' : 'N';
  }
  formatEventId(eventId) {
    return eventId;
  }
  loadAccount() { 
    return serverService.getStudyParticipant(this.studyId, this.userId);
  }
  link(postfix) {
    return `/studies/${this.studyId}/participants/${encodeURIComponent(this.userId)}/${postfix}`;
  }
  hoverText(item) {
    let str = '';
    if (item.studyBurstId) {
      str = `<b>Study burst “${item.studyBurstId}”</b><br>trigger event: “${item.originEventId}”<br><br>` + str;
    }
    return str + ((item.recordCount <= 1) ? '1 record' : `${item.recordCount} records`);
  }
  deleteEvent(event, browserEvent) {
    let msg = "Are you sure?";
    if (typeof event.originEventId === 'undefined') {
      msg += " Study burst events triggered by this event will also be deleted.";
    }
    let self = ko.contextFor(browserEvent.target).$component;
    alerts.deleteConfirmation(msg, () => {
      utils.startHandler(self, event);
      let eventId = event.eventId;
      serverService.deleteStudyParticipantActivityEvent(self.studyId, self.userId, eventId)
        .then(utils.successHandler(self, event, "Event deleted."))
        .then(() => serverService.getStudyParticipantActivityEvents(self.studyId, self.userId))
        .then(res => self.itemsObs(res.items))
        .catch(utils.failureHandler({ id: 'studyparticipant-schedule' }));
    });
  }
  canEdit(item) {
    let updateType = item.updateType;
    return updateType === 'mutable' || updateType === 'future_only';
  }
  canDelete(item) {
    let updateType = item.updateType;
    return updateType === 'mutable';
  }
  editEvent(event, browserEvent) {
    let self = ko.contextFor(browserEvent.target).$component;
    root.openDialog('event_editor', {
      event: ((event.timestamp) ? event : null),
      studyId: self.studyId,
      userId: self.userId,
      saveEvent: self.saveEvent.bind(self)
    });
  }
  createEvent(event) {
    root.openDialog('event_editor', {
      event: ((event.timestamp) ? event : null),
      studyId: this.studyId,
      userId: this.userId,
      saveEvent: this.saveEvent.bind(this)
    });
  }
  saveEvent(event, updateBursts) {
    return serverService.createStudyParticipantActivityEvent(this.studyId, this.userId, event, updateBursts)
      .then(() => serverService.getStudyParticipantActivityEvents(this.studyId, this.userId, updateBursts))
      .then(sortRes)
      .then(res => this.itemsObs(res.items));
  }
}