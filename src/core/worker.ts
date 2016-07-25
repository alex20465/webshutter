/**
 * This module to manager and laucher Processor.components.
 */

import q = require('q');
import async = require('async');
import winston = require('winston');

import {queue} from './queue';
import {producer} from './producer';
import {config} from './config';
import {utils} from './utils';
import {component} from './component';

export namespace worker {

    /**
     * Launcher class to start/stop ProcessorComponents using a
     * componentManager.
     */
    export class Launcher {

        /**
         * Runtime configuration object,
         */
        protected config: config.Interface;

        /**
         * Component manager instance.
         */
        protected manager: component.Manager;

        /**
         * Container for all initialized processor components.
         */
        protected processors: Array<component.processor.Base>;

        /**
         * Defined queue instance to pass into the components.
         *
         * USED FOR TESTING.
         */
        protected usedQueue: queue.Interface;

        /**
         * The logger instance for the launcher.
         */
        protected log: winston.LoggerInstance;

        /**
         * Constructor
         */
        constructor(config: config.Interface) {
            this.config = config;
            this.manager = new component.Manager(config);
            this.processors = [];
            this.log = utils.create_logger('worker.Launcher');
        }

        /**
         * Setter for the used queue.
         */
        setUsedQueue(q: queue.Interface) {
            this.usedQueue = q;
        }

        /**
         * Method to start all found processorComponents.
         */
        start(): q.Promise<any> {
            var d = q.defer<any>();

            this.manager.load();
            var component_classes = this.manager.findBy(component.processor.Base);

            async.eachSeries(component_classes, (com_cls: any, next: any) => {
                var processor: component.processor.Base = new com_cls(
                    this.config, this.usedQueue);
                this.processors.push(processor);
                processor.start()
                    .then(next)
                    .catch((err) => {
                        this.log.error(err.message);
                    });
            }, (err: Error) => {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve();
                }
            });

            return d.promise;
        }

        /**
         * Method to stop all started processorComponents.
         */
        stop(): q.Promise<any> {
            var d = q.defer<any>();

            async.eachSeries(this.processors, (processor: component.processor.Base, next: any) => {
                processor.stop().then(next).catch((err) => {
                    this.log.error(err.message);
                });
            }, (err: Error) => {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve();
                }
            });

            return d.promise;
        }
    }
}
