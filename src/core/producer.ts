/**
 * This Module provides all necessary elements to manage/produce Jobs.
 */

import express = require('express');
import q = require('q');
import async = require('async');
import winston = require('winston');

import {queue} from './queue';
import {utils} from './utils';


export namespace producer {

    /**
     * Represents the producer for the jobs, we use this only as base,
     * provides the functionality to submit the produced jobs into a Queue.
     */
    export class Base<T> {

        /**
         * The unfinished queue name for the new submitted job.
         */
        DESTINATION = 'null';

        /**
         * The finished queue prefix, completed by the producer hash.
         */
        SOURCE = 'null';

        /**
         * Required parameters to produce jobs.
         */
        protected params: T;

        /**
         * Random generated producer hash, used to put the finished jobs into
         * a specific queue, using this hash.
         */
        public hash: string;

        /**
         * Producer error container.
         */
        public errors: Array<Error>;

        /**
         * The logger instance for this producer.
         */
        protected log: winston.LoggerInstance;

        /**
         * Constructor.
         */
        constructor(params: T) {
            this.params = params;
            this.errors = [];
            this.hash = utils.random_string(15);
            this.log = utils.create_logger('producer.Base');
        }

        /**
         * Method to produce jobs.
         */
        produce(): Array<producer.job.Base<any>> {

            throw 'NotImplemented';
        }

        /**
         * Method to validate the used parameters for the production.
         */
        validate(): boolean {

            throw 'NotImplemented';
        }

        /**
         * Method to produce->submit the jobs into a queue and promise the
         * process of the jobs.
         *
         * Use the progress of the promise to receive notification:
         *     notification-format:
         *         {state: <submit|processed>, target: job }
         *
         * after all submitted jobs are collected, we resolve the promise.
         */
        submit(_queue: queue.Interface) {
            var d = q.defer();

            if (this.validate()) {
                let jobs = this.produce();
                this.log.info('submit producer jobs:', jobs.length);
                // submit jobs
                async.eachSeries(jobs, (job: producer.job.Base<any>, next: Function) => {
                    _queue.put(this.DESTINATION, job.serialize())
                        .then(() => { next(); })
                        .catch((e) => {
                            d.reject(e);
                            next(e);
                        });
                }, () => {
                    this.log.info('jobs submitted, wait for the results to queue:', this.SOURCE + this.hash);
                    // wait for processing
                    var waitingFor = jobs.length;
                    _queue.get(this.SOURCE + this.hash)
                        .progress( (control: queue.Control) => {
                            this.log.debug('receive result bytes:', control.target.length);
                            d.notify(control.target);
                            waitingFor--;
                            if (waitingFor === 0) {
                                this.log.debug('no results more to wait, stop');
                                control.break();
                            } else {
                                this.log.debug('waiting for more results,', waitingFor);
                                control.continue();
                            }
                        } )
                        .then( () => {
                            this.log.info('received all results.');
                            d.resolve();
                        } )
                        .catch( (e) => {
                            d.reject(e);
                        } );
                });

            } else {
                d.reject(new Error('parameters invalid'));
            }

            return d.promise;
        }

        /**
         * Method to exchange the logger.
         */
        public setLogger(logger: winston.LoggerInstance) {
            this.log = logger;
        }
    }
}


export namespace producer.job {

    /**
     * Job base class.
     */
    export class Base<T> {

        name: string = 'base';

        /**
         * Here we store the needed information to execute the job.
         */
        public params: T;

        /**
         * The id/hash of the producer, needed for the results.queue-key.
         */
        public producer_id: string;

        /**
         * Job id/hash.
         * @type {string}
         */
        public id: string;

        /**
         * Container for the job results.
         */
        public results: any;

        /**
         * Container for errors related to the job.
         */
        protected errors: Array<Error>;

        /**
         * constructor
         */
        constructor(id: string, producer_id: string, params: T) {
            this.id = id;
            this.producer_id = producer_id;
            this.params = params;
            this.errors = [];
        }

        /**
         * Method to serialize the attributes for the jobs using
         * JSON.stringify.
         */
        serialize(): string {

            var errors = this.errors.map( (err: Error) => {
                return {
                    name: err.name,
                    message: err.message,
                    stack: err.stack
                };
            } );

            return JSON.stringify({
                name: this.name,
                id: this.id,
                params: this.params,
                results: this.results,
                errors: errors,
                producer_id: this.producer_id
            });
        }

        /**
         * Add an error to the error container.
         */
        addError( err: Error ) {
            this.errors.push(err);
        }

        /**
         * Clear all errors of the job.
         */
        clearErrors() {
            this.errors = [];
        }
    }
}

