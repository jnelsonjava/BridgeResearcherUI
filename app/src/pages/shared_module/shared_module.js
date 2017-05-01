var sharedModuleUtils = require('../../shared_module_utils');
var serverService = require('../../services/server_service');
var bind = require('../../binder');
var utils = require('../../utils');
var root = require('../../root');
var fn = require('../../transforms');

var OPTIONS = [
    {value: null, label:'Both'},
    {value: 'Android', label: 'Android'},
    {value: 'iOS', label: 'iOS'}
];

function tagsToView(tags) {
    return (tags || []).join(", ");
}
function tagsToModel(tags) {
    return tags.split(/\s?,\s?/).filter(function(v) { return v !== ""; });
}
function loadSurveyRevisions(vm, survey) {
    return serverService.getSurveyAllRevisions(survey.guid).then(function(response) {
        // Need to confirm, but if you link to unpublished survey, it is just published
        // when you publish the metadata... ?
        var dates = response.items.map(function(oneSurvey) {
            var d = fn.formatLocalDateTime(oneSurvey.createdOn);
            return {value: oneSurvey.createdOn, label: d};
        });
        vm.linkedVersionOptionsObs(dates);
    });
}
function loadSchemaRevisions(vm, schema) {
    return serverService.getUploadSchemaAllRevisions(schema.id).then(function(response) {
        var revisions = response.items.map(function(oneSchema) {
            return {value: oneSchema.revision, label: oneSchema.revision};
        });
        vm.linkedVersionOptionsObs(revisions);
    });
}
module.exports = function(params) {
    var self = this;
    self.editor = null;
    self.metadata = {tags:[], version: 1};

    var binder = bind(self)
        .obs('isNew', params.id === "new")
        .obs('at', params.id)
        .bind('published', false)
        .bind('id')
        .bind('licenseRestricted', false)
        .bind('name', '')
        .bind('notes', '', notesToView, notesToModel)
        .bind('os', null)
        .bind('tags', '', tagsToView, tagsToModel)
        .bind('version', 1)
        .bind('schemaId')
        .bind('schemaRevision')
        .obs('schemaVersions[]')
        .obs('linkedName', '&lt;None&gt;')
        .obs('linkedVersion')
        .obs('linkedVersionOptions[]', [])
        .bind('surveyGuid')
        .bind('surveyCreatedOn')
        .obs('surveyVersions[]');

    self.linkedVersionObs.subscribe(function(newValue) {
        if (self.metadata.surveyGuid) {
            self.surveyCreatedOnObs(newValue);
            self.schemaIdObs(null);
        } else if (self.metadata.schemaId) {
            self.schemaIdObs(newValue);
            self.surveyCreatedOnObs(null);
        }
    });

    function updateId(metadata) {
        params.id = metadata.id;
        self.isNewObs(false);
        self.idObs(metadata.id);
        self.versionObs(metadata.version);
        self.publishedObs(metadata.published);
        self.metadata.id = metadata.id;
        self.metadata.version = metadata.version;
        self.metadata.published = metadata.published;
        return metadata;
    }
    function updateSharedModuleWithNames(metadata) {
        self.linkedNameObs(sharedModuleUtils.formatMetadataLinkedItem(metadata));
        if (metadata.surveyGuid) {
            loadSurveyRevisions(self, {guid: metadata.surveyGuid}).then(function() {
                self.linkedVersionObs(metadata.surveyCreatedOn);
            });
        } else if (metadata.schemaId) {
            loadSchemaRevisions(self, {schemaId: metadata.schemaId}).then(function() {
                self.linkedVersionObs(metadata.revision);
            });
        } else {
            self.linkedVersionOptionsObs([]);
        }
        return metadata;
    }
    function notesToView(notes, context) {
        // It's a race, whichever loads last (data or editor) does the initialization.
        if (self.editor) {
            self.editor.setData(notes);
        }
    }
    function notesToModel() {
        return self.editor.getData();
    }
    function getSchemaList() {
        return (self.metadata.schemaId) ? [{id: self.metadata.schemaId}] : [];
    }
    function getSurveyList() {
        return (self.metadata.surveyGuid) ? [{guid: self.metadata.surveyGuid}] : [];
    }
    function loadMetadata() {
         return serverService.getMetadataVersion(params.id, params.version);
    }

    self.osOptions = OPTIONS;

    self.openSchemaSelector = function() { 
        self.metadata = binder.persist(self.metadata);
        root.openDialog('select_schemas',{
            addSchemas: self.addSchemas,
            allowMostRecent: false,
            selected: getSchemaList(),
            selectOne: true
        });
    };
    self.openSurveySelector = function() { 
        self.metadata = binder.persist(self.metadata);
        root.openDialog('select_surveys',{
            addSurveys: self.addSurveys,
            allowMostRecent: false,
            selected: getSurveyList(),
            selectOne: true
        });
    };
    self.addSchemas = function(schemas) {
        self.surveyGuidObs(null);
        self.surveyCreatedOnObs(null);

        var schema = schemas[0];
        self.schemaIdObs(schema.id);
        self.schemaRevisionObs(schema.revision);
        self.linkedNameObs("Schema: " + schema.id);
        loadSchemaRevisions(self, schema).then(function() {
            self.linkedVersionObs(schema.revision);
        });
        root.closeDialog();
    };
    self.addSurveys = function(surveys) {
        self.schemaIdObs(null);
        self.schemaRevisionObs(null);

        var survey = surveys[0];
        self.surveyGuidObs(survey.guid);
        self.surveyCreatedOnObs(survey.createdOn);
        self.linkedNameObs("Survey: " + survey.name);
        loadSurveyRevisions(self, survey).then(function() {
            self.linkedVersionObs(survey.createdOn);
        });
        root.closeDialog();
    };
    self.initEditor = function(ckeditor) {
        self.editor = ckeditor;
        self.editor.setData(self.metadata.notes);
    };
    self.save = function(vm, event) {
        var oldVersion = self.metadata.version; // prior to updating from model
        self.metadata = binder.persist(self.metadata);
        var methodName = (params.id === "new" || self.metadata.version !== oldVersion) ?
            "createMetadata" : "updateMetadata";
        if (oldVersion !== self.versionObs()) {
            self.metadata.published = false;
        }

        utils.startHandler(vm, event);
        serverService[methodName](self.metadata)
            .then(updateId)
            .then(utils.successHandler(vm, event, "Shared module saved."))
            .catch(utils.failureHandler(vm, event));
    };
    if (params.id !== "new") {
        sharedModuleUtils.loadNameMaps()
            .then(loadMetadata)
            .then(binder.assign('metadata'))
            .then(binder.update())
            .then(updateSharedModuleWithNames)
            .catch(utils.notFoundHandler("Shared module", "shared_modules"));
    }
};
