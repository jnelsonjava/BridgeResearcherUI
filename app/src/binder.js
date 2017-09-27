import ko from 'knockout';
import fn from './functions.js';
import jsonFormatter from './json_formatter';

function nameInspector(string) {
    var isArray = /\[\]$/.test(string);
    var name = (isArray) ? string.match(/[^\[]*/)[0] : string;
    return {name: name, observableName: name+"Obs", isArray: isArray};
}
function createObservable(doBinding) {
    return function(name, defaultValue, modelTransform, obsTransform) {
        var info = nameInspector(name);
        // No default because registering one indicates you want an update for a model
        // whether it has a property for the observer or not.
        info.modelTransform = modelTransform;
        info.obsTransform = obsTransform || fn.identity; // not needed for an observer
        info.bind = doBinding;
        
        var value = (typeof defaultValue === "undefined") ? undefined : defaultValue;
        // Don't call the transform for the initial value. We have transforms that 
        // require study to be loaded and this is usually too early in the cycle for 
        // that to be true. Just init the value you want to see in the world.
        var obs = (info.isArray) ?
            ko.observableArray(value) :
            ko.observable(value);
        this.vm[info.observableName] = info.observable = obs;
        this.fields[info.name] = info;
        return this;
    };
}

export default class Binder {
    constructor(vm) {
        this.vm = vm;
        this.fields = {};
        /**
         * Create an observable on the view model that updates the model object.
         * Update will update the observable, and persist will update the model 
         * object.
         * 
         * @param name - the name of the property on the model object
         * @param defaultValue - a default value for this field, can null
         * @param modelTransform - a pure function that formats a model value before
         *      setting an observer with the value
         * @param obsTransform - a pure function that formats the value of an 
         *      observable before updating a model object
         */
        this.bind = createObservable(true);
        /**
         * Create an observable on the view model that does not update the model object.
         * Update will update the observable, but persist will not update the model 
         * object. An observer transform is not needed because the observer will not be 
         * used to update a model object.
         * 
         * @param name - the name of the property on the model object
         * @param defaultValue - a default value for this field, can null
         * @param modelTransform - a pure function that formats a model value before
         *      setting an observer with the value
         */
        this.obs = createObservable(false);
    }
    /**
     * Returns a function that can be registered as a callback to receive a model and 
     * update observables in the view model. If no field names are supplied, all observables 
     * that have a name that matches a field of the model will be updated. Before being 
     * copied to an observable, the value is passed through the "model transform" function, 
     * if one is provided. The transform receives the following arguments:
     *  - value (the value of the observable)
     *  - context - a context with these properties:
     *      - oldValue - the current value of the observable
     *      - model - the whole model object being updated (not the copy being updated!)
     *      - vm - the viewModel
     *      - observer - the observable instance
     */
    update() {
        console.assert(arguments.length === 0 || typeof arguments[0] === 'string',
            "binder.update() returns function for updating, do not call directly with a model object.");
        var fields = (arguments.length > 0) ? arguments : Object.keys(this.fields);
        return (model) => {
            for (var i=0; i < fields.length; i++) {
                var field = fields[i];
                var info = this.fields[field];
                var context = {oldValue: info.observable(), model: model, vm: this.vm, observer: info.observable};
                if (info.modelTransform) {
                    var value = info.modelTransform(model[field], context);
                    info.observable(value);
                } else if (typeof model[field] !== "undefined") {
                    info.observable(model[field]);
                } else {
                    // no transform, no defined value, just do nothing. This should obviate 
                    // the need for fn.maintainValue many places. 
                }
            }
            return model;
        };
    }
    /**
     * Persist all the bound observables (two-way data bound) created with bind() back to a 
     * copy of the model object, maintaining all the existing properties that are not updated.
     * 
     * @param model - the model to serve as a basis for the updated model object. Each value 
     * from an observable is passed to the "observer transform" for processing, if it was defined. 
     * The transform receives the following arguments:
     *  - value (the value of the observable)
     *  - context - a context with these properties:
     *      - oldValue - the current value on the model
     *      - copy - the whole model object being updated (not the copy being updated!)
     *      - model - the original model object being updated
     *      - vm - the viewModel
     *      - observer - the observer
     */
    persist(model) {
        var copy = Object.assign({}, model);
        Object.keys(this.fields).forEach(field => {
            var info = this.fields[field];
            if (info.bind) {
                var context = {oldValue: model[info.name], model: model, 
                    copy: copy, vm: this.vm, observer: info.observable};
                var value = info.obsTransform(info.observable(), context);
                if (value !== null && typeof value !== "undefined") {
                    copy[info.name] = value;    
                } else {
                    delete copy[info.name];
                }
            }
        });
        return copy;
    }
    assign(field) {
        console.assert(typeof field === 'string', 'string field value must be supplied');
        return (model) => {
            this.vm[field] = model;
            return model;
        };
    }
    /**
     * Retrieve the value of a property on an object that is set as a property on the model 
     * (rather than directly as a property of the model);
     */
    static fromObjectField(fieldName, objFieldName) {
        return function(value, context) {
            context.model[fieldName] = context.model[fieldName] || {};
            return context.model[fieldName][objFieldName];
        };
    }
    /**
     * Write the observer to the property of an object that is a property on the model 
     * (rather than directly on the model);
     */
    static toObjectField(fieldName, objFieldName) {
        return function(value, context)  {
            context.model[fieldName] = context.model[fieldName] || {};
            if (typeof value !== "undefined") {
                context.model[fieldName][objFieldName] = value;
            } else {
                delete context.model[fieldName][objFieldName];
            }
        };
    }
    static objPropDelegates(fieldName, objFieldName) {
        return {
            toObject: Binder.toObjectField(fieldName, objFieldName),
            fromObject: Binder.fromObjectField(fieldName, objFieldName)
        };
    }
    static persistAttributes(value) {
        return value.reduce(function(map, value) {
            map[value.key] = value.obs();
            return map;
        }, {});
    }
    static formatTitle(value, context) {
        var user = context.model;
        if (user.id === "new" && fn.isBlank(user.firstName) && fn.isBlank(user.lastName)) {
            return "New participant";
        }
        return fn.formatName(context.model);
    }
    static formatAttributes(value, context) {
        context.vm.attributesObs().map(function(attr) {
            attr.obs(value[attr.key]);
        });
        return context.vm.attributesObs();
    }
    static formatHealthCode(value, context) {
        return (context.vm.study.healthCodeExportEnabled) ? value : 'N/A';
    }
    static callObsCallback(value, context) {
        return context.observer.callback();
    }
    static fromJson(json, context) {
        if (json) {
            try {
                return jsonFormatter.prettyPrint(json);
            } catch(e) {
                console.error(e);
            }
        }
        return '';
    }
    static toJson(string, context) {
        if (string) {
            try {
                return JSON.parse(string);
            } catch(e) {
                console.error(e);
            }
            return null;
        }
    }
}
