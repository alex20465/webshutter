/**
 * This module provides elements to make the application extendible, using
 * components.
 *
 * TYPES:
 *
 * ActionComponent:
 *     Component to extend the HTTP-Routing by registering and handle
 *     http-server-actions.
 *
 * ProcessorComponent:
 *     Component started by the worker.Launcher, to processes submitted jobs.
 */

import path = require('path');
import express = require('express');
import q = require('q');
import winston = require('winston');

import {config} from './config';
import {producer} from './producer';
import {server} from './server';
import {queue} from './queue';
import {utils} from './utils';
import {worker} from './worker';


/**
 * Component root namespace.
 *
 * Provides basic elements to manager and handle component-elements.
 */
export namespace component {

    /**
     * Defines the component key-names, used by the component-detection.
     */
    var ACCEPTABLE_COMPONENTS: Object = {
        ActionComponent: () => { return action.Base; },
        ProcessorComponent: () => { return processor.Base; }
    };

    /**
     * Component manager, used to load and search components by the inheritance.
     */
    export class Manager {

        /**
         * Defined component import string of the config.
         */
        protected component_imports: Array<string>;

        /**
         * Container for the detected component classes.
         */
        protected components: Array<Base>;

        /**
         * constructor
         */
        constructor(config: config.Interface) {
            this.component_imports = config.components;
            this.components = [];
        }

        /**
         * Searches for valid component-types and pushes it into the component
         * container.
         */
        public load() {
            this.component_imports.forEach( (imp) => {

                var import_data = this.resolveImportData(imp);

                var mod = require(import_data.req);

                if (!mod[import_data.ns]) {
                    throw new Error(
                        `expected namespace: ${import_data.ns}, not exists!`);
                }

                var detectedComponents: Array<any> = this.detectComponents(
                    mod[import_data.ns]);

                detectedComponents.forEach( (component: any) => {
                    // set static value as the name of the components
                    // used by the name.getter.
                    component._NAME = `${import_data.ns}.${component.name}`;
                } );

                if (!detectedComponents.length) {
                    throw new Error(
                        `no component exports detected from module: ${imp}`);
                } else {
                    this.components = this.components.concat(
                        detectedComponents);
                }
            } );
        }

        /**
         * Method to search and find components based on the passed
         * component type.
         */
        public findBy(com_type: any) {
            return this.components.map((com) => {
                if ((<any>com).prototype instanceof com_type) {
                    return com;
                } else {
                    return null;
                }
            }).filter( (com) => {
                if (com === null) {
                    return false;
                } else {
                    return true;
                }
            } );
        }

        /**
         * Method to resolve an importString and parse it to an object.
         */
        protected resolveImportData(imp: string) {
            var ns: string;
            var req: string;

            if (imp.indexOf(':') !== -1) {
                /**
                 * Detect namespace separator, split and redefine.
                 */
                var parts = imp.split(':');
                imp = parts[0];
                ns = parts[1];
            }

            if (imp[0] === '.') {
                /**
                 * Detect relative component defintion,
                 * resolve path and continue.
                 */
                req = path.join(__dirname, '../', imp);
                ns = ns || path.basename(imp);
            } else {
                /**
                 * Probably a module component definition,
                 * use the redefined namespace or use the modulename as
                 * namespace.
                 */
                ns = ns || imp;
                req = imp;
            }

            return {
                ns: ns,
                req: req
            };
        }

       /**
        * Method to detect validated components inside a module, using
        * the ACCEPTABLE_COMPONENTS white-list.
        */
        protected detectComponents(ns_obj: any): Array<Object> {

            var detectedComponents: Array<any> = [];

            Object.keys(ACCEPTABLE_COMPONENTS).forEach((key: string) => {

                if (ns_obj[key]) {
                    let com_type = (<any>ACCEPTABLE_COMPONENTS)[key]();

                    if (ns_obj[key].prototype instanceof com_type) {
                        detectedComponents.push(ns_obj[key]);
                    } else {
                        //
                    }
                } else {
                    //
                }
            } );

            return detectedComponents;
        }
    }

    /**
     * The base of all components.
     */
    export class Base {

        /**
         * The name of the component, defined by the method Manager.load which
         * depend of the import-string.
         */
        public static _NAME: string;

        /**
         * Configuration container.
         */
        protected config: config.Interface;

        /**
         * Logger instance of the component, using the utils.create_logger
         * function.
         */
        protected log: winston.LoggerInstance;

        /**
         * constructor
         */
        constructor(config: config.Interface) {
            this.config = config;
            this.log = utils.create_logger(this.name + `(${process.pid})`);
            this.log.debug('Initialize');
        }

        /**
         * Getter for the configuration container.
         */
        public getConfig() {

            return this.config;
        }

        /**
         * Magic getter of the name using the static access.
         */
        private get name() {

            return (<any>this).constructor._NAME;
        }
    }
}

/**
 * Component to extend the HTTPServer actions.
 *
 * The base idea of this component-type is to extend HTTP-Interface,
 * by write actions, which we register to the express-application instance.
 */
export namespace component.action {

    /**
     * Interface to implement when create a action-component.
     */
    export interface Interface {

        /**
         * The route of the actions used for the action registration
         * by the expressjs application.
         *
         * Documentation:
         *     http://expressjs.com/de/guide/routing.html
         */
        ROUTE: string;

        /**
         * The action handler.
         *
         * To access request/response object just use:
         *     this.getResponse or this.getRequest
         */
        action(): void;
    }

    /**
     * The base for a action-component, which provides functionality
     * to access expressjs elements like res, req etc.
     */
    export class Base extends component.Base {

        /**
         * The request object of the expressjs-application,
         * updated every each request.
         */
        protected request: express.Request;

        /**
         * The response object of the expressjs-application,
         * updated every each request.
         */
        protected response: express.Response;

        /**
         * The server instance, created by expressjs.
         */
        protected server: server.Base;

        /**
         * constructor
         */
        constructor(config: config.Interface) {
            super(config);
        }

        /**
         * Request setter.
         */
        public setRequest(req: express.Request) {
            this.request = req;
        }

        /**
         * Response setter.
         */
        public setResponse(res: express.Response) {
            this.response = res;
        }

        /**
         * Server setter.
         */
        public setServer(server: server.Base) {
            this.server = server;
        }
    }
}

/**
 * Component used as worker processor.
 *
 * The idea of this component-type is to extend and write own worker-processes,
 * by fetch unfinished jobs of specific queues.
 */
export namespace component.processor {

    /**
     * Component interface.
     */
    export interface Interface {

        /**
         * The source of the processor, used as the queue-key to GET
         * unfinished jobs.
         */
        SOURCE: string;

        /**
         * The destination of the finished jobs, used as queue-key to
         * PUT the jobs back with defined results|errors.
         */
        DESTINATION: string;

        /**
         * The processor method to process the unfinished job.
         *
         * Following options are available after processing the job:
         * callback and finish the process, using:
         *
         *     this.finish({"status: 400})
         *
         * abort and report an error, by calling:
         *
         *     this.abort(new Error("there is something wrong!"))
         */
        process(): void;

        /**
         * Method to instantiate a JobBase instance using the dump.
         */
        restoreJob(dump: Object): producer.job.Base<any>;
    }

    /**
     * The component base, provides functionality to GET, PUT and
     * call the .process method.
     */
    export class Base extends component.Base {

        /**
         * The used queue to GET, PUT jobs.
         */
        private queue: queue.Interface;

        /**
         * The current loaded job to processes,
         * will be updated each time.
         */
        private job: producer.job.Base<any>;

        /**
         * Current created q.Deferred for the process job,
         * used to resolve or reject the process promise.
         */
        private currentDeferred: q.Deferred<any>;

        /**
         * Contains the information: processor is running or NOT
         */
        private stopped: boolean;

        /**
         * Constructor
         */
        constructor(config: config.Interface, _queue?: queue.Interface) {
            super(config);
            this.stopped = true;
            this.queue = _queue || (new queue.Redis(config));
        }

        /**
         * Method to get jobs using the queue method queue.get and create
         * the job instance using the dump object.
         *
         * To receive jobs while promising, it requires a progress registration,
         * which accepts a queue.Control object.
         *
         * Example:
         *
         * .. code::
         *
         *     component.getSubmitted()
         *         .progress( function(control){
         *             control.break();
         *         } );
         */
        private getSubmitted(): q.Promise<any> {
            var d = q.defer();
            this.queue.get((<Interface>(<any>this)).SOURCE)
                .progress( (control: queue.Control) => {

                    var dump = JSON.parse(control.target);

                    this.log.debug(
                        'receive job to process:', dump.id || 'no_id');

                    control.target = (<Interface>(<any>this)).restoreJob(dump);
                    d.notify(control);
                } ).then(d.resolve).catch(d.reject);

            return d.promise;
        }

        /**
         * Method to submit a finished job to the connected queue.
         */
        private submitFinished(job: producer.job.Base<any>): q.Promise<any> {
            var key: string = (<Interface>(<any>this)).DESTINATION + job.producer_id;
            this.log.debug('submit job:', job.id, 'to', key );
            return this.queue.put(key, job.serialize());
        }

        /**
         * Connect to the queue and pop unfinished job for processing,
         * after processing is done, continue listening.
         */
        public start(): q.Promise<any> {
            this.stopped = false;
            this.log.info('starting');
            return this.queue.connect()
                .then( () => {
                    return this.getSubmitted()
                        .progress( (control: queue.Control) => {
                            var job: producer.job.Base<any> = control.target;
                            this.job = job;
                            this.currentDeferred = q.defer();
                            this.currentDeferred.promise.then( (results: any) => {
                                job.results = results;
                                this.log.debug('job process done, submit results:', results);
                                return this.submitFinished(job);
                            } )
                            .then( () => {
                                this.log.info('continue get unfinished jobs ...');
                                control.continue();
                            } )
                            .catch( (err) => {
                                this.log.info('an error has been occurred: ', err.message);
                                job.addError(err);
                                return this.submitFinished(job)
                                    .then( () => {
                                        // after handle the error
                                        this.log.info('continue get unfinished jobs ...');
                                        control.continue();
                                    } );
                            } );

                            try {
                                // process and wait to call the methods: finish/abort
                                (<Interface>(<any>this)).process();
                            } catch (e) {
                                this.abort(e);
                            }

                        } );
                } );
        }

        /**
         * Stop the processor and disconnect the used queue.
         */
        public stop(): q.Promise<any> {
            var d = q.defer();
            this.stopped = true;
            if (this.queue.is_connected()) {
                this.queue.disconnect();
                d.resolve();
            }
            return d.promise;
        }

        /**
         * Getter for the current job to process.
         */
        protected getJob() {

            return this.job;
        }

        /**
         * Method to report the finish state of the process and
         * submit the job with the results.
         */
        protected finish(results: any) {
            var job = this.getJob();
            this.log.info('finish job of producer:', job.producer_id);

            this.currentDeferred.resolve(results);
        }

        /**
         * Method to report the abort state of the process, defined
         * the error message to the job and submitted to the finish queue
         * anyway. The errors should be handle by the producer.
         */
        protected abort(err: Error) {
            var job = this.getJob();
            this.log.warn(
                'abort job of producer:', job.producer_id + ',', err.message);
            this.currentDeferred.reject(err);
        }
    }
}
