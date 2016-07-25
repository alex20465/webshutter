/// <reference path="../typings/jasmine/jasmine.d.ts" />

import {queue} from '../src/core';

describe('mock-queue', () => {

    var q: queue.Mock;

    beforeEach( (done) => {
        q = new queue.Mock();

        q.connect().then(done);
    } );

    afterEach( (done) => {
        q.disconnect().then(done);
    } );

    it( 'should put and get the item', (done) => {

        var received_item: any = null;

        q.get('fire')
            .progress( (control: queue.Control) => {
                received_item = control.target;
                control.break();
            } )
            .then( () => {
                expect(received_item).toBe('works');
                done();
            } );

        q.put('fire', 'works');
    } );
});

describe('redis-queue (redis server)', () => {

    var q: queue.Redis;
    var bad_queue: queue.Redis;

    beforeEach( () => {
        q = new queue.Redis();
        bad_queue = new queue.Redis({
            redis: {
                host: 'localhost',
                port: 6378
            }
        });
    } );

    afterEach( (done) => {
        if (q.is_connected()) {
            q.disconnect().then(done);
        } else {
            done();
        }
    } );

    it( 'should connect to the server', (done) => {
        q.connect()
            .then(() => {
                expect(q.is_connected()).toBeTruthy();
                done();
            })
            .catch((err) => {
                expect(false).toBeTruthy(err.message);
                done();
            });
    } );

    it('should disconnect when call disconnection', (done) => {
        q.connect()
            .then(() => {
                return q.disconnect();
            })
            .then(() => {
                expect(q.is_connected()).toBeFalsy();
                done();
            })
            .catch((err) => {
                expect(false).toBeTruthy(err.message);
                done();
            });
    });

    it('should put a item and get it back', (done) => {
        var items: Array<string> = [];

        q.connect()
            .then(() => {
                return q.put('test', 'foo');
            })
            .then(() => {
                return q.get('test', 0.5)
                    .progress((control: queue.Control) => {
                        items.push(control.target);
                        control.break();
                    });
            })
            .then(() => {
                let item = items.pop();
                expect(item).toBe('foo');
                done();
            })
            .catch((err) => {
                expect(false).toBeTruthy(err.message);
                done();
            });
    });

    it('should put multiple items and get it back', (done) => {
        var items: Array<string> = [];

        q.connect()
            .then(() => {
                return q.put('test', 'foo');
            })
            .then(() => {
                return q.put('test', 'foo2');
            })
            .then(() => {
                return q.get('test', 0.5)
                    .progress((control: queue.Control) => {
                        items.push(control.target);

                        if (items.length === 2) {
                            control.break();
                        } else {
                            control.continue();
                        }
                    });
            })
            .then(() => {
                expect(items.length).toBe(2);
                expect(items).toContain('foo');
                expect(items).toContain('foo2');
                done();
            })
            .catch((err) => {
                expect(false).toBeTruthy(err.message);
                done();
            });
    });
});
