/**
 * This module provides Queue systems using a specific common used \
 * interface.
 */

import {config} from './config';
import q = require('q');
import redis = require('redis');


export namespace queue {

    /**
     * The interface of the Queue.get progress, which provides controlling.
     */
    export interface Control {

        /**
         * continue get/listening to the queue
         */
        break: Function;

        /**
         * break, stop the loop
         */
        continue: Function;

        /**
         * target, queued item reporting
         */
        target: any;
    }

    /**
     * The base queue interface of all queues.
     */
    export interface Interface {

        /**
         * Put a single item to a queue.
         */
        put(name: string, data: string|Buffer): q.Promise<any>;

        /**
         * Get items of a specific queue until timeout is reached, until \
         * control.break is called or until the connection is lost.
         */
        get(name: string, timeout?: number): q.Promise<any>;

        /**
         * Connect to the queue.
         */
        connect(): q.Promise<any>;

        /**
         * Disconnect the queue.
         */
        disconnect(): q.Promise<any>;

        /**
         * Get the connection status.
         */
        is_connected(): boolean;
    }

    /**
     * A mock internal used Queue for testing purposes only.
     */
    export class Mock implements Interface {

        /**
         * Mock the connected queue.
         */
        public queues: any;

        /**
         * Mock the connection status.
         */
        private connected: boolean;

        /**
         * Constructor.
         */
        constructor() {
            this.queues = {};
            this.connected = false;
        }

        /**
         * @inherit
         */
        put(name: string, data: string|Buffer): q.Promise<any> {
            var d = q.defer();

            setTimeout(() => {
                if (this.queues[name] === undefined) {
                    this.queues[name] = [];
                }
                this.queues[name].push(data);
                d.resolve();
            }, 0);

            return d.promise;
        }

        /**
         * @inherit
         */
        get(name: string, timeout?: number): q.Promise<any> {
            var d = q.defer();

            if (this.queues[name] === undefined) {
                this.queues[name] = [];
            }

            var loop = () => {
                var item = this.queues[name].pop();
                if (item) {
                    d.notify({
                        continue:  () => { loop(); },
                        break:     () => { d.resolve(); },
                        target: item
                    });

                    return;
                }

                if (this.is_connected()) {
                    setTimeout(loop, 50);
                } else {
                    d.resolve();
                }
            };

            setTimeout(loop, 0);

            return d.promise;
        }

        /**
         * @inherit
         */
        connect(): q.Promise<any> {
            var d = q.defer();
            setTimeout(() => {
                this.connected = true;
                d.resolve();
            }, 0);
            return d.promise;
        }

        /**
         * @inherit
         */
        disconnect(): q.Promise<any> {
            var d = q.defer();
            setTimeout(() => {
                this.connected = false;
                d.resolve();
            }, 0);
            return d.promise;
        }

        /**
         * @inherit
         */
        is_connected(): boolean {
            return this.connected;
        }
    }


    /**
     * Redis queue implementation. NotImplemented
     */
    export class Redis implements Interface {

        protected client: redis.RedisClient;
        protected options: any;

        /**
         * constructor
         */
        constructor(config?: config.Interface) {

            config = config || {};
            config.redis = config.redis || (<any>{});

            this.options = {
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db
            };
        }

        /**
         * @inherit
         */
        put(key: string, data: string|Buffer): q.Promise<any> {
            var d = q.defer();
            this.client.rpush(key, data, () => {
                d.resolve();
            });
            return d.promise;
        }

        /**
         * @inherit
         */
        get(key: string, timeout?: number): q.Promise<any> {
            var d = q.defer();

            var loop = () => {
                this.client.blpop([key, 0], (err: Error, item: string) => {
                    if (err) {
                        return q.reject(err);
                    } else {
                        d.notify({
                            continue:  () => { loop(); },
                            break:     () => { d.resolve(); },
                            target: item[1]
                        });
                    }
                });
            };

            loop();

            return d.promise;
        }

        /**
         * @inherit
         */
        connect(): q.Promise<any> {
            var d = q.defer();

            this.client = redis.createClient(this.options);

            var errorEvent: Function;
            var connectEvent: Function;

            connectEvent = () => {
                this.client.removeListener('error', errorEvent);
                this.client.removeListener('connect', connectEvent);
                d.resolve();
            };

            errorEvent = (e: Error) => {
                this.client.removeListener('error', errorEvent);
                this.client.removeListener('connect', connectEvent);
                d.reject(e);
            };
            this.client.addListener('error', errorEvent);
            this.client.addListener('connect', connectEvent);

            return d.promise;
        }

        /**
         * @inherit
         */
        disconnect(): q.Promise<any> {
            var d = q.defer();

            var errorEvent: Function;
            var endEvent: Function;

            endEvent = () => {
                this.client.removeListener('error', errorEvent);
                this.client.removeListener('end', endEvent);
                d.resolve();
            };

            errorEvent = (e: Error) => {
                this.client.removeListener('error', errorEvent);
                this.client.removeListener('end', endEvent);
                d.reject(e);
            };
            this.client.addListener('error', errorEvent);
            this.client.addListener('end', endEvent);

            this.client.quit();

            return d.promise;
        }

        /**
         * @inherit
         */
        is_connected(): boolean {

            if (this.client) {
                return this.client.connected;
            } else {
                return false;
            }
        }
    }
}

