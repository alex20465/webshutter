/**
 * This module contains a action and processor component to render
 * a page, using the phantomjs headless browser.
 */

import express = require('express');
import phantom = require('phantom');

import q = require('q');

import * as core from '../core';


export namespace webphantom {

    /**
     * Queue key|channel|tube for the unfinished jobs.
     */
    var QK_UNFINISHED: string = 'RENDER:UNF';

    /**
     * Queue key|channel|tube for the finished jobs.
     */
    var QK_FINISHED: string = 'RENDER:FIN:';

    /**
     * Required parameters for the job producer.
     */
    export interface ParamsInterface {
        /**
         * Interface for the RenderJobParameter.
         */

        /**
         * The URL of the website to render.
         */
        url: string;

        /**
         * The used device, to render.
         */
        device?: core.devices.INDEX;
    }

    /**
     * The class used for a render job.
     */
    export class Job extends core.producer.job.Base<ParamsInterface> {
        /**
         * Job to render a website.
         */

        name: string = 'render';
    }

    /**
     * Represents the producer for the render-jobs.
     */
    export class Producer extends core.producer.Base<ParamsInterface> {

        /**
         * @inherit
         */
        DESTINATION = QK_UNFINISHED;

        /**
         * @inherit
         */
        SOURCE = QK_FINISHED;

        /**
         * @inherit
         */
        validate(): boolean {
            if (this.params.device && !core.devices.INDEX[this.params.device]) {
                this.errors.push(new Error('invalid device!'));
            }
            if (!this.params.url || !this.params.url.length) {
                this.errors.push(new Error('invalid url!'));
            }

            return !this.errors.length;
        }

        /**
         * @inherit
         */
        produce(): Array<Job> {
            // producer the job instances
            var job = new Job(this.hash + '_1', this.hash, this.params);
            return [job];
        }
    }

    /**
     * Action component to produce jobs and submit to the unfinished queue.
     */
    export class ActionComponent extends core.component.action.Base implements core.component.action.Interface {

        /**
         * Used queue class.
         */
        public static QUEUE: any = core.queue.Redis;

        /**
         * @inherit
         */
        ROUTE = '/render';

        /**
         * @inherit
         */
        action() {

            var prod = new Producer(this.request.query);
            prod.setLogger(this.log);
            var res = this.response;

            if (prod.validate()) {

                this.log.debug('receive job request:', this.request.query);

                var q = ActionComponent.createQueue(this.getConfig());

                // when response is done, disconnect the queue.
                res.on('close', () => {
                    this.log.debug('queue connection closed.');
                    if (q.is_connected()) { q.disconnect(); }
                });

                q.connect()
                    .then( () => {
                        this.log.debug('queue connected.');
                        prod.produce();
                        return prod.submit(q)
                            .progress((json_str) => {
                                res.write(json_str);
                            })
                            .then(() => {
                                res.end();
                            });
                    } )
                    .catch((err) => {
                        res.write(err.message);
                        res.status(500);
                        res.end();
                    });
            } else if (prod.errors.length) {
                res.write(prod.errors.pop().message);
                res.status(400);
                res.end();
            } else {
                // 500
                res.status(400);
                res.end();
            }
        }

        /**
         * Method to create the queue instance for the action.
         */
        public static createQueue(config: core.config.Interface): core.queue.Interface {

            return new ActionComponent.QUEUE(config);
        }
    }

    /**
     * Processor component, to processes the submitted render-jobs by the action.
     */
    export class ProcessorComponent extends core.component.processor.Base implements core.component.processor.Interface {

        /**
         * @inherit
         */
        SOURCE = QK_UNFINISHED;

        /**
         * @inherit
         */
        DESTINATION = QK_FINISHED;

        /**
         * @inherit
         */
        process() {

            var job = this.getJob();
            var results: any = {};
            var webpage: phantom.WebPage;
            var ph: phantom.PhantomJS;
            var hash: string = core.utils.random_string();
            var tmppath: string = `/tmp/_render/${hash}.png`;

            phantom.create()
                .then( (ph_) => {
                    ph = ph_;
                    return ph.createPage();
                } )
                .then( (page) => {
                    webpage = page;
                    var req_out = (<any>ph).createOutObject();
                    var res_out = (<any>ph).createOutObject();

                    req_out.data = [];
                    res_out.data = [];

                    (<any>page).property('onResourceReceived', (data: any, out: any) => {
                        out.data.push(data);
                    }, req_out);

                    (<any>page).property('onResourceRequested', (data: any, net: any, out: any) => {
                        out.data.push(data);
                    }, res_out);

                    page.open(job.params.url);

                    return res_out.property('data')
                        .then( (responses: any) => {
                            results.responses = responses;
                            return req_out.property('data');
                        } )
                        .then( (requests: any) => {
                            results.requests = requests;
                        } );
                } )
                .then( () => {
                    return webpage.renderBase64('PNG');
                } )
                .then( (base64) => {
                    ph.exit();
                    results.screenshot = base64;
                    this.finish(results);
                } )
                .catch(this.abort.bind(this));
        }

        /**
         * @inherit
         */
        restoreJob(dump: any) {
            return (new Job(dump.id, dump.producer_id, dump.params));
        }
    }
}
